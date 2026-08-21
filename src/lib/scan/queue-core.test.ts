import { describe, expect, it } from 'vitest';

import {
  applyResults,
  chunk,
  drainOrder,
  isRetryable,
  nextRetryDelayMs,
  summarise,
  type QueuedScan,
} from './queue-core';

const scan = (over: Partial<QueuedScan> = {}): QueuedScan => ({
  clientUuid: 'u1',
  type: 'RECEIVE',
  payload: {},
  clientTimestamp: '2026-08-20T10:00:00.000Z',
  status: 'pending',
  attempts: 0,
  ...over,
});

describe('chunk', () => {
  it('splits into request-sized batches, preserving order', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns nothing for an empty queue', () => {
    expect(chunk([], 50)).toEqual([]);
  });

  it('refuses a nonsense chunk size rather than looping forever', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe('drainOrder', () => {
  it('sends oldest first — a putaway is validated against the receive before it', () => {
    const items = [
      scan({ clientUuid: 'later', clientTimestamp: '2026-08-20T11:00:00.000Z' }),
      scan({ clientUuid: 'earlier', clientTimestamp: '2026-08-20T09:00:00.000Z' }),
    ];
    expect(drainOrder(items).map((i) => i.clientUuid)).toEqual(['earlier', 'later']);
  });

  it('leaves synced and failed items out of the drain', () => {
    const items = [
      scan({ clientUuid: 'a' }),
      scan({ clientUuid: 'b', status: 'synced' }),
      scan({ clientUuid: 'c', status: 'error' }),
    ];
    expect(drainOrder(items).map((i) => i.clientUuid)).toEqual(['a']);
  });
});

describe('applyResults', () => {
  const now = '2026-08-20T12:00:00.000Z';

  it('marks a successful scan as synced', () => {
    const [item] = applyResults(
      [scan()],
      [{ clientUuid: 'u1', status: 'success', detail: 'Received 5.' }],
      now,
    );
    expect(item).toMatchObject({ status: 'synced', syncedAt: now });
  });

  it('treats a duplicate as done, not as a failure', () => {
    const [item] = applyResults(
      [scan()],
      [{ clientUuid: 'u1', status: 'duplicate', detail: 'Already recorded.' }],
      now,
    );
    // Anything else leaves it in the queue retrying something that can never
    // change — the exact loop the idempotency key exists to prevent.
    expect(item.status).toBe('synced');
  });

  it('keeps a rejected scan with its reason for the operator', () => {
    const [item] = applyResults(
      [scan()],
      [{ clientUuid: 'u1', status: 'error', detail: 'Only 1 remain on order AMZ-1001.' }],
      now,
    );
    expect(item).toMatchObject({ status: 'error', attempts: 1 });
    expect(item.lastError).toContain('AMZ-1001');
  });

  it('folds field-level issues into the message', () => {
    const [item] = applyResults(
      [scan()],
      [
        {
          clientUuid: 'u1',
          status: 'error',
          detail: 'Scan failed validation.',
          issues: [{ path: 'quantity', message: 'must be greater than zero' }],
        },
      ],
      now,
    );
    expect(item.lastError).toContain('quantity: must be greater than zero');
  });

  it('leaves items the server did not report on untouched', () => {
    const [item] = applyResults([scan()], [], now);
    expect(item.status).toBe('pending');
  });
});

describe('summarise', () => {
  it('counts pending and failed separately', () => {
    const summary = summarise([
      scan({ clientUuid: 'a' }),
      scan({ clientUuid: 'b' }),
      scan({ clientUuid: 'c', status: 'error' }),
      scan({ clientUuid: 'd', status: 'synced', syncedAt: '2026-08-20T12:00:00.000Z' }),
    ]);
    // A pending scan resolves itself; a failed one needs a person. Merging them
    // would tell the operator the wrong story.
    expect(summary).toEqual({
      pending: 2,
      failed: 1,
      lastSyncedAt: '2026-08-20T12:00:00.000Z',
    });
  });

  it('reports the most recent sync, not the first', () => {
    const summary = summarise([
      scan({ clientUuid: 'a', status: 'synced', syncedAt: '2026-08-20T09:00:00.000Z' }),
      scan({ clientUuid: 'b', status: 'synced', syncedAt: '2026-08-20T11:00:00.000Z' }),
    ]);
    expect(summary.lastSyncedAt).toBe('2026-08-20T11:00:00.000Z');
  });

  it('says never when nothing has synced', () => {
    expect(summarise([scan()]).lastSyncedAt).toBeNull();
  });
});

describe('retry policy', () => {
  it('backs off, but never beyond a minute', () => {
    expect(nextRetryDelayMs(1)).toBe(2_000);
    expect(nextRetryDelayMs(2)).toBe(4_000);
    expect(nextRetryDelayMs(20)).toBe(60_000);
  });

  it('does not retry a scan the server has already refused once', () => {
    // It will fail identically forever; the operator has to resolve it.
    expect(isRetryable(scan({ status: 'error', attempts: 1 }))).toBe(false);
    expect(isRetryable(scan())).toBe(true);
  });
});
