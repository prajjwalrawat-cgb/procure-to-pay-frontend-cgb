'use client';

import { useState } from 'react';

import { useScanSync } from '@/lib/scan/use-sync';

/** "3m ago" — an operator needs recency, not a timestamp. */
function ago(iso: string | null): string {
  if (!iso) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

/**
 * The sync indicator: connectivity, how many scans are waiting, and how many
 * were rejected.
 *
 * Failures get their own count rather than being folded into "pending" — a
 * pending scan resolves itself, a rejected one needs the operator to do
 * something, and showing them as one number tells them the wrong story.
 */
export function SyncStatus(): React.JSX.Element {
  const { online, pending, failed, lastSyncedAt, syncNow } = useScanSync();
  const [syncing, setSyncing] = useState(false);

  const tone = !online
    ? 'bg-warn/15 text-warn'
    : failed > 0
      ? 'bg-danger/15 text-danger'
      : pending > 0
        ? 'bg-accent/15 text-accent'
        : 'bg-ok/15 text-ok';

  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-[13px] ${tone}`}
      disabled={syncing || !online}
      onClick={() => {
        setSyncing(true);
        void syncNow().finally(() => setSyncing(false));
      }}
    >
      <span className="font-medium">
        {!online ? 'Offline — scans are being saved' : syncing ? 'Syncing…' : 'Online'}
      </span>
      <span className="tabular-nums">
        {pending > 0 ? `${pending} pending` : 'all synced'}
        {failed > 0 ? ` · ${failed} failed` : ''}
        <span className="opacity-70"> · {ago(lastSyncedAt)}</span>
      </span>
    </button>
  );
}
