import type { BatchSyncItemResult, ScanType } from '@/lib/shared';

/**
 * The offline queue's logic, deliberately free of IndexedDB and of React.
 *
 * The warehouse floor is exactly where connectivity fails, so this queue is not
 * an optimisation — it is the only thing standing between a dropped signal and
 * a lost count. Keeping the rules pure means they can be tested properly
 * (chunking, reconciliation, retry) rather than only exercised through a
 * browser database that the unit test environment does not have.
 */

/** A scan the device has recorded but the server may not have seen yet. */
export interface QueuedScan {
  /** Client-generated idempotency key. The queue's primary key, and the server's. */
  clientUuid: string;
  type: ScanType;
  /** The request body for the matching endpoint, minus the envelope fields. */
  payload: Record<string, unknown>;
  /** CYCLE_COUNT scans belong to a session. */
  sessionId?: string | null;
  /** When the device recorded it — the queue drains in this order. */
  clientTimestamp: string;
  status: 'pending' | 'synced' | 'error';
  attempts: number;
  lastError?: string | null;
  /** Set once the server has accepted (or recognised) the scan. */
  syncedAt?: string | null;
}

/** What the status pill shows. */
export interface QueueSummary {
  pending: number;
  failed: number;
  lastSyncedAt: string | null;
}

/** The server accepts at most 50 scans per request — see ScanBatchSyncInputSchema. */
export const SYNC_CHUNK_SIZE = 50;

/** Split a drain into request-sized chunks, preserving order. */
export function chunk<T>(items: T[], size: number = SYNC_CHUNK_SIZE): T[][] {
  if (size < 1) throw new Error('chunk size must be at least 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Queue order is chronological, always.
 *
 * A putaway can only be validated against the receive in front of it, and a
 * pick against the stock those two produced. Draining out of order would make
 * perfectly good scans fail on rules about state that has not arrived yet.
 */
export function drainOrder(items: QueuedScan[]): QueuedScan[] {
  return [...items]
    .filter((i) => i.status === 'pending')
    .sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp));
}

/**
 * Fold one batch-sync response back onto the queue.
 *
 * `duplicate` is a success: it means the server already has this scan, which is
 * precisely what the idempotency key is for. Treating it as a failure would
 * leave the item in the queue forever, retrying something that can never
 * change.
 */
export function applyResults(
  items: QueuedScan[],
  results: BatchSyncItemResult[],
  now: string,
): QueuedScan[] {
  const byUuid = new Map(results.map((r) => [r.clientUuid, r]));

  return items.map((item) => {
    const result = byUuid.get(item.clientUuid);
    if (!result) return item;

    if (result.status === 'success' || result.status === 'duplicate') {
      return { ...item, status: 'synced' as const, syncedAt: now, lastError: null };
    }
    return {
      ...item,
      status: 'error' as const,
      attempts: item.attempts + 1,
      lastError: detailOf(result),
    };
  });
}

/** A readable failure line, including field errors when the server sent them. */
export function detailOf(result: BatchSyncItemResult): string {
  if (!result.issues || result.issues.length === 0) return result.detail;
  const fields = result.issues.map((i) => `${i.path}: ${i.message}`).join('; ');
  return `${result.detail} (${fields})`;
}

/** Counts for the sync indicator. */
export function summarise(items: QueuedScan[]): QueueSummary {
  const synced = items
    .filter((i) => i.status === 'synced' && i.syncedAt)
    .map((i) => i.syncedAt as string)
    .sort();

  return {
    pending: items.filter((i) => i.status === 'pending').length,
    failed: items.filter((i) => i.status === 'error').length,
    lastSyncedAt: synced.length > 0 ? (synced[synced.length - 1] as string) : null,
  };
}

/**
 * Backoff between drain attempts, capped at a minute.
 *
 * Capped because the failure this retries is almost always "the van has not
 * reached the loading bay yet". Backing off for ten minutes would mean an
 * operator watching a "3 pending" badge long after the signal returned.
 */
export function nextRetryDelayMs(attempts: number): number {
  const base = 2_000 * 2 ** Math.max(0, attempts - 1);
  return Math.min(base, 60_000);
}

/**
 * Whether a failed item is worth retrying automatically.
 *
 * A validation failure — over-pick, unknown barcode — will fail identically
 * every time; retrying it forever hides it from the operator, who is the only
 * one who can resolve it. Those surface in the UI instead.
 */
export function isRetryable(item: QueuedScan): boolean {
  return item.status === 'pending' || (item.status === 'error' && item.attempts < 1);
}
