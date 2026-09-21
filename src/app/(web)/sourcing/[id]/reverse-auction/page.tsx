'use client';

import { EmptyState, Input, PageHeader, Pill } from '@/components/ui';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReverseAuctionLeaderboardEntry } from '@/lib/shared';

import { API_URL } from '@/lib/env';
import { inr } from '@/lib/format';

/**
 * Live reverse-auction console: a basic SSE leaderboard for one round. A
 * countdown, extension banners and bid history are not built yet.
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
          { label: 'RFQ', href: `/sourcing/${id}` },
          { label: 'Reverse auction' },
        ]}
        meta={
          // The connection state is load-bearing here: an offline stream means
          // the ladder below is stale, not that nobody is bidding.
          <Pill variant={connected ? 'success' : 'neutral'} dot>
            {connected ? 'Live' : 'Offline'}
          </Pill>
        }
        description="Watch the live bid ladder for a round."
      />

      <label className="mb-4 block max-w-md">
        <span className="text-text mb-1 block text-caption font-medium">Round</span>
        <Input
          placeholder="Round ID (rar_…) to watch the live leaderboard"
          value={roundId}
          onChange={(e) => setRoundId(e.target.value)}
        />
      </label>

      {!connected && roundId && (
        <p role="status" className="border-warn/30 bg-warn-bg text-warn mb-4 rounded-lg border px-3 py-2 text-caption">
          Not connected to the live stream — the ladder below may be out of date.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left text-caption text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">Rank</th>
              <th className="px-3 py-2.5 font-medium">Vendor</th>
              <th className="px-3 py-2.5 text-right font-medium">Bid</th>
              <th className="px-3 py-2.5 text-right font-medium">Gap to L1</th>
              <th className="px-3 py-2.5 font-medium">At</th>
            </tr>
          </thead>
          <tbody>
            {board.length === 0 && (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    title={roundId ? 'No bids yet' : 'Choose a round to watch'}
                    detail={
                      roundId
                        ? 'Bids appear here the moment a vendor places one.'
                        : 'Enter the round ID above to subscribe to its live leaderboard.'
                    }
                  />
                </td>
              </tr>
            )}
            {board.map((e) => (
              <tr key={e.rank} className="border-line border-b last:border-0">
                <td className="px-3 py-3.5">
                  <Pill variant={e.rank === 1 ? 'success' : 'neutral'}>{e.rankLabel}</Pill>
                </td>
                <td className="px-3 py-3.5">{e.vendorName ?? `Bidder ${e.rankLabel}`}</td>
                <td className="font-numeric px-3 py-3.5 text-right">
                  {e.bidPrice ? inr(e.bidPrice) : '—'}
                </td>
                <td className="font-numeric text-muted px-3 py-3.5 text-right">
                  {e.gapToL1 ? inr(e.gapToL1) : '—'}
                </td>
                <td className="font-numeric text-muted px-3 py-3.5 text-caption">
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
