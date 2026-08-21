import type { BatchSyncResponse } from '@/lib/shared';
import { describe, expect, it, vi } from 'vitest';

import type { ScanQueueStore } from './queue';
import type { QueuedScan } from './queue-core';
import { ScanSyncManager } from './sync-manager';

/** An in-memory stand-in for IndexedDB, which the node test env does not have. */
function memoryStore(
  initial: QueuedScan[] = [],
): ScanQueueStore & { rows: () => QueuedScan[] } {
  let rows = [...initial];
  return {
    rows: () => rows,
    all: async () => [...rows],
    put: async (scan) => {
      rows = [...rows.filter((r) => r.clientUuid !== scan.clientUuid), scan];
    },
    putMany: async (scans) => {
      const ids = new Set(scans.map((s) => s.clientUuid));
      rows = [...rows.filter((r) => !ids.has(r.clientUuid)), ...scans];
    },
    remove: async (clientUuid) => {
      rows = rows.filter((r) => r.clientUuid !== clientUuid);
    },
    clearSynced: async () => {
      const before = rows.length;
      rows = rows.filter((r) => r.status !== 'synced');
      return before - rows.length;
    },
  };
}

const scan = (id: string, at: string): QueuedScan => ({
  clientUuid: id,
  type: 'RECEIVE',
  payload: { barcodeRaw: '001', quantity: 1 },
  clientTimestamp: at,
  status: 'pending',
  attempts: 0,
});

const response = (results: BatchSyncResponse['results']): BatchSyncResponse => ({
  results,
  summary: {
    total: results.length,
    succeeded: results.filter((r) => r.status === 'success').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    failed: results.filter((r) => r.status === 'error').length,
  },
});

const NOW = '2026-08-20T12:00:00.000Z';

describe('drain', () => {
  it('sends pending scans oldest-first and marks them synced', async () => {
    const store = memoryStore([
      scan('b', '2026-08-20T11:00:00.000Z'),
      scan('a', '2026-08-20T09:00:00.000Z'),
    ]);
    const post = vi.fn(async (batch: QueuedScan[]) =>
      response(
        batch.map((s) => ({
          clientUuid: s.clientUuid,
          status: 'success' as const,
          detail: 'ok',
        })),
      ),
    );

    const result = await new ScanSyncManager(store, post, () => NOW).drain();

    expect(post.mock.calls[0]?.[0].map((s) => s.clientUuid)).toEqual(['a', 'b']);
    expect(result).toMatchObject({ attempted: 2, succeeded: 2, failed: 0 });
    expect(store.rows().every((r) => r.status === 'synced')).toBe(true);
  });

  it('keeps good scans and flags only the rejected one', async () => {
    const store = memoryStore([
      scan('a', '2026-08-20T09:00:00.000Z'),
      scan('b', '2026-08-20T10:00:00.000Z'),
    ]);
    const post = vi.fn(async () =>
      response([
        { clientUuid: 'a', status: 'success', detail: 'ok' },
        { clientUuid: 'b', status: 'error', detail: 'Only 1 remain on the line.' },
      ]),
    );

    const result = await new ScanSyncManager(store, post, () => NOW).drain();

    expect(result).toMatchObject({ succeeded: 1, failed: 1 });
    expect(store.rows().find((r) => r.clientUuid === 'a')?.status).toBe('synced');
    const failed = store.rows().find((r) => r.clientUuid === 'b');
    // Surfaced, not dropped — the operator is the only one who can resolve it.
    expect(failed).toMatchObject({ status: 'error' });
    expect(failed?.lastError).toContain('Only 1 remain');
  });

  it('leaves everything pending when the network fails mid-drain', async () => {
    const store = memoryStore([scan('a', '2026-08-20T09:00:00.000Z')]);
    const post = vi.fn(async () => {
      throw new Error('Failed to fetch');
    });

    const result = await new ScanSyncManager(store, post, () => NOW).drain();

    expect(result.transportError).toBe('Failed to fetch');
    // A dead signal is not the scan's fault; it must be retried, not failed.
    expect(store.rows()[0]?.status).toBe('pending');
  });

  it('splits a long queue into chunks the server will accept', async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      scan(
        `u${String(i).padStart(3, '0')}`,
        `2026-08-20T09:${String(i % 60).padStart(2, '0')}:00.000Z`,
      ),
    );
    const store = memoryStore(many);
    const post = vi.fn(async (batch: QueuedScan[]) =>
      response(
        batch.map((s) => ({
          clientUuid: s.clientUuid,
          status: 'success' as const,
          detail: 'ok',
        })),
      ),
    );

    await new ScanSyncManager(store, post, () => NOW).drain();

    expect(post).toHaveBeenCalledTimes(3);
    expect(post.mock.calls.every(([batch]) => batch.length <= 50)).toBe(true);
  });

  it('does nothing when the queue is empty', async () => {
    const post = vi.fn();
    const result = await new ScanSyncManager(
      memoryStore(),
      post as never,
      () => NOW,
    ).drain();

    expect(post).not.toHaveBeenCalled();
    expect(result.attempted).toBe(0);
  });

  it('ignores a second drain while one is already running', async () => {
    const store = memoryStore([scan('a', '2026-08-20T09:00:00.000Z')]);
    // Held in an object so TypeScript does not narrow the callback away.
    const gate: { release: () => void } = { release: () => undefined };
    const post = vi.fn(async (batch: QueuedScan[]) => {
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });
      return response(
        batch.map((s) => ({
          clientUuid: s.clientUuid,
          status: 'success' as const,
          detail: 'ok',
        })),
      );
    });

    const manager = new ScanSyncManager(store, post, () => NOW);
    const first = manager.drain();
    const second = await manager.drain(); // must not queue a second send
    gate.release();
    await first;

    expect(second.attempted).toBe(0);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('subscribers', () => {
  it('reports the queue counts after a drain', async () => {
    const store = memoryStore([
      scan('a', '2026-08-20T09:00:00.000Z'),
      scan('b', '2026-08-20T10:00:00.000Z'),
    ]);
    const post = vi.fn(async () =>
      response([
        { clientUuid: 'a', status: 'success', detail: 'ok' },
        { clientUuid: 'b', status: 'error', detail: 'rejected' },
      ]),
    );

    const manager = new ScanSyncManager(store, post, () => NOW);
    const seen: { pending: number; failed: number }[] = [];
    manager.subscribe((s) => seen.push({ pending: s.pending, failed: s.failed }));

    await manager.drain();

    expect(seen.at(-1)).toEqual({ pending: 0, failed: 1 });
  });
});
