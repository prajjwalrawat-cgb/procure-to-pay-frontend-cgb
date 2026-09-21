'use client';

import { PageHeader, Pill } from '@/components/ui';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReverseAuctionLeaderboardEntry } from '@/lib/shared';

import { API_URL } from '@/lib/env';
import { inr } from '@/lib/format';

/**
 * Live reverse-auction console (Slice 6 §8). Basic SSE leaderboard — production
 * polish (countdown, extension banners, bid history) is deferred to Slice 6.5.
 * Pass ?round=<id> to subscribe to a specific round's stream.
 */
export default function ReverseAuctionPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [roundId, setRoundId] = useState('');
  const [board, setBoard] = useState<ReverseAuctionLeaderboardEntry[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roundId) return;
    const url = `${API_URL}/rfq/${id}/reverse-auction/${roundId}/leaderboard/stream`;
    const es = new EventSource(url, { withCredentials: true });
    es.onopen = () => setConnected(true);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as {
          leaderboard: ReverseAuctionLeaderboardEntry[];
        };
        setBoard(data.leaderboard);
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [id, roundId]);

  return (
    <div>
      <PageHeader
        title="Reverse auction"
        breadcrumbs={[
          { label: 'Sourcing', href: '/sourcing' },
          { label: 'Reverse auction' },
        ]}
        meta={
          // The connection state is load-bearing here: an offline stream means
          // the ladder below is stale, not that nobody is bidding.
          <Pill variant={connected ? 'success' : 'gray'} dot>
            {connected ? 'live' : 'offline'}
          </Pill>
        }
        description="Watch the live bid ladder for a round."
      />

      <label className="mb-4 block">
        <span className="text-muted mb-1 block text-caption font-medium">Round</span>
        <input
          className="border-line bg-panel h-9 w-full rounded-sm border px-2 text-body-sm"
          placeholder="Round ID (rar_…) to watch the live leaderboard"
          value={roundId}
          onChange={(e) => setRoundId(e.target.value)}
        />
      </label>

      {!connected && roundId && (
        <p className="border-warn/30 bg-warn-wash text-warn mb-4 rounded-lg border px-3 py-2 text-caption">
          Not connected to the live stream — the ladder below may be out of date.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="border-line border-b text-left text-caption text-muted">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2 text-right">Bid</th>
              <th className="px-3 py-2 text-right">Gap to L1</th>
              <th className="px-3 py-2">At</th>
            </tr>
          </thead>
          <tbody>
            {board.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted px-3 py-6 text-center">
                  Waiting for bids…
                </td>
              </tr>
            )}
            {board.map((e) => (
              <tr key={e.rank} className="border-line border-b last:border-0">
                <td className="px-3 py-2">
                  <Pill variant={e.rank === 1 ? 'success' : 'gray'}>{e.rankLabel}</Pill>
                </td>
                <td className="px-3 py-2">{e.vendorName ?? `Bidder ${e.rankLabel}`}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {e.bidPrice ? inr(e.bidPrice) : '—'}
                </td>
                <td className="text-muted px-3 py-2 text-right tabular-nums">
                  {e.gapToL1 ? inr(e.gapToL1) : '—'}
                </td>
                <td className="text-muted px-3 py-2 text-caption">
                  {e.bidAt ? new Date(e.bidAt).toLocaleTimeString('en-IN') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
