'use client';

import { useEffect, useState } from 'react';

import { postBatchSync } from '@/lib/api/scan';

import { scanQueue } from './queue';
import type { QueueSummary } from './queue-core';
import { ScanSyncManager, type SyncResult } from './sync-manager';

/**
 * One sync manager per tab. A second instance would drain the same queue
 * concurrently: harmless on the server thanks to idempotency, but it doubles a
 * warehouse's already-thin bandwidth and makes the pending count flicker.
 */
let manager: ScanSyncManager | null = null;

function syncManager(): ScanSyncManager {
  manager ??= new ScanSyncManager(scanQueue, postBatchSync);
  return manager;
}

export interface ScanSyncState extends QueueSummary {
  online: boolean;
  /** Drain now — the manual "Sync" affordance behind the status pill. */
  syncNow: () => Promise<SyncResult>;
}

/**
 * Live queue state for the status indicator.
 *
 * Reconnection triggers the drain inside the manager, not here: the operator
 * should never have to press anything for a queued scan to be sent. `syncNow`
 * exists for the case where they want reassurance rather than because the app
 * needs it.
 */
export function useScanSync(): ScanSyncState {
  const [summary, setSummary] = useState<QueueSummary>({
    pending: 0,
    failed: 0,
    lastSyncedAt: null,
  });
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const mgr = syncManager();
    const unsubscribe = mgr.subscribe(setSummary);
    mgr.start();

    setOnline(navigator.onLine);
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      // The manager itself is deliberately left running: it is a tab-level
      // singleton, and stopping it on a screen change would stop draining the
      // queue the moment the operator navigated.
    };
  }, []);

  return {
    ...summary,
    online,
    syncNow: () => syncManager().drain(),
  };
}

/** Refresh the queue counters after a local write, without waiting for a sync. */
export async function refreshQueueCounters(): Promise<void> {
  await syncManager().drain();
}
