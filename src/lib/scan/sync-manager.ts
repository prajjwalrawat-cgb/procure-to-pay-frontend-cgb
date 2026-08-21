'use client';

import type { BatchSyncResponse } from '@/lib/shared';

import type { ScanQueueStore } from './queue';
import {
  applyResults,
  chunk,
  drainOrder,
  summarise,
  type QueueSummary,
  type QueuedScan,
} from './queue-core';

/** Posts one chunk to the API. Injected so the manager is testable offline. */
export type BatchPoster = (scans: QueuedScan[]) => Promise<BatchSyncResponse>;

export interface SyncResult {
  attempted: number;
  succeeded: number;
  duplicates: number;
  failed: number;
  /** Set when the whole drain failed — no connectivity, server down. */
  transportError?: string;
}

/**
 * ScanSyncManager — drains the offline queue when the device comes back.
 *
 * Three behaviours matter more than the plumbing:
 *
 * 1. **Reconnection is the trigger, not a button.** An operator who has just
 *    walked back into signal should not have to know the queue exists.
 * 2. **Chronological order.** A putaway is validated against the receive in
 *    front of it; draining out of order invents failures.
 * 3. **Per-item outcomes survive.** The server reports each scan separately, so
 *    one rejected over-pick is shown against that scan and the rest still land.
 *    A failed item is never silently dropped.
 */
export class ScanSyncManager {
  private draining = false;
  private listeners = new Set<(summary: QueueSummary) => void>();
  private detach: (() => void) | null = null;

  constructor(
    private readonly store: ScanQueueStore,
    private readonly post: BatchPoster,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** Start draining on reconnect (and once now, in case we start online). */
  start(): void {
    if (typeof window === 'undefined' || this.detach) return;

    const onOnline = (): void => {
      void this.drain();
    };
    window.addEventListener('online', onOnline);
    // A tab restored from the background may have missed the online event.
    const onVisible = (): void => {
      if (document.visibilityState === 'visible' && navigator.onLine) void this.drain();
    };
    document.addEventListener('visibilitychange', onVisible);

    this.detach = () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };

    if (navigator.onLine) void this.drain();
  }

  stop(): void {
    this.detach?.();
    this.detach = null;
    this.listeners.clear();
  }

  /** Subscribe to queue-count changes (the status pill). */
  subscribe(listener: (summary: QueueSummary) => void): () => void {
    this.listeners.add(listener);
    void this.notify();
    return () => this.listeners.delete(listener);
  }

  /**
   * Send everything pending. Safe to call at any time: a second concurrent call
   * returns immediately rather than sending the same scans twice — which the
   * server would deduplicate anyway, but which would waste a warehouse's
   * already-poor bandwidth.
   */
  async drain(): Promise<SyncResult> {
    if (this.draining) return { attempted: 0, succeeded: 0, duplicates: 0, failed: 0 };
    this.draining = true;

    try {
      const pending = drainOrder(await this.store.all());
      if (pending.length === 0) {
        return { attempted: 0, succeeded: 0, duplicates: 0, failed: 0 };
      }

      let succeeded = 0;
      let duplicates = 0;
      let failed = 0;

      for (const batch of chunk(pending)) {
        let response: BatchSyncResponse;
        try {
          response = await this.post(batch);
        } catch (err) {
          // Transport failure: the scans stay pending and are retried on the
          // next reconnect. Marking them failed would hide good scans behind a
          // problem that had nothing to do with them.
          await this.notify();
          return {
            attempted: pending.length,
            succeeded,
            duplicates,
            failed,
            transportError: err instanceof Error ? err.message : 'Sync failed',
          };
        }

        const updated = applyResults(batch, response.results, this.now());
        await this.store.putMany(updated);

        succeeded += response.summary.succeeded;
        duplicates += response.summary.duplicates;
        failed += response.summary.failed;
        await this.notify();
      }

      return { attempted: pending.length, succeeded, duplicates, failed };
    } finally {
      this.draining = false;
    }
  }

  /** Push a fresh summary to every subscriber. */
  private async notify(): Promise<void> {
    if (this.listeners.size === 0) return;
    const summary = summarise(await this.store.all());
    for (const listener of this.listeners) listener(summary);
  }
}
