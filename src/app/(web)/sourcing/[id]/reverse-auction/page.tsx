'use client';

import { Pill } from '@/components/ui';
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
    <div className="mx-auto max-w-[720px]">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          Reverse auction
        </h1>
        <Pill variant={connected ? 'success' : 'gray'}>
          {connected ? 'live' : 'offline'}
        </Pill>
      </div>

      <input
        className="border-line bg-panel mb-4 h-9 w-full rounded-md border px-2 text-[13px]"
        placeholder="Round ID (rar_…) to watch the live leaderboard"
        value={roundId}
        onChange={(e) => setRoundId(e.target.value)}
      />

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="text-muted border-line border-b text-left">
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
                <td className="text-muted px-3 py-2 text-[12px]">
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
