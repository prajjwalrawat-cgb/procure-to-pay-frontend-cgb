'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui';
import { scanQueue } from '@/lib/scan/queue';
import type { QueuedScan } from '@/lib/scan/queue-core';
import { refreshQueueCounters } from '@/lib/scan/use-sync';

/**
 * Scans the server refused.
 *
 * These are the ones that must never disappear quietly. A rejected scan means
 * the shelf and the system disagree — an over-pick, a barcode nobody has
 * registered, stock that is not where the operator is standing — and only the
 * person holding the goods can settle it. Retrying them forever in the
 * background would bury the disagreement; dropping them would lose the count.
 */
export function FailedScans(): React.JSX.Element | null {
  const [failed, setFailed] = useState<QueuedScan[]>([]);

  const load = useCallback(async () => {
    try {
      const all = await scanQueue.all();
      setFailed(all.filter((s) => s.status === 'error'));
    } catch {
      // IndexedDB unavailable (private mode, unsupported browser) — the screens
      // still work online; there is simply no queue to show.
      setFailed([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed.length === 0) return null;

  return (
    <section className="space-y-3 rounded-lg border border-danger/40 bg-danger/5 p-3">
      <h2 className="text-[13px] font-semibold text-danger">
        {failed.length} scan{failed.length === 1 ? '' : 's'} need attention
      </h2>

      <ul className="space-y-2">
        {failed.map((scan) => (
          <li
            key={scan.clientUuid}
            className="rounded-md border border-line bg-white p-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium">{scan.type}</span>
              <span className="text-[11px] tabular-nums text-muted">
                {new Date(scan.clientTimestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-danger">{scan.lastError ?? 'Rejected'}</p>
            <p className="mt-1 text-[11px] text-muted">
              {String(scan.payload.barcodeRaw ?? '')} ×{' '}
              {String(scan.payload.quantity ?? '')}
            </p>

            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="default"
                className="text-[12px]"
                onClick={() => {
                  // Back to pending: the operator has fixed the underlying
                  // problem (raised the order quantity, registered the barcode)
                  // and wants the original scan applied as recorded.
                  void scanQueue
                    .put({ ...scan, status: 'pending', lastError: null })
                    .then(refreshQueueCounters)
                    .then(load);
                }}
              >
                Retry
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-[12px] text-muted"
                onClick={() => {
                  void scanQueue.remove(scan.clientUuid).then(load);
                }}
              >
                Discard
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
