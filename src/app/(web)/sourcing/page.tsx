'use client';

import { Button, Pill } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useRfqList, type RfqTab } from '@/lib/api/sourcing';
import { inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: RfqTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'my_action', label: 'Awaiting my action' },
  { key: 'evaluation', label: 'Under evaluation' },
  { key: 'awarded', label: 'Awarded' },
  { key: 'cancelled', label: 'Cancelled' },
];

function countdown(deadline: string | null): {
  label: string;
  variant: 'success' | 'warn' | 'danger' | 'gray';
} {
  if (!deadline) return { label: '—', variant: 'gray' };
  const ms = new Date(deadline).getTime() - Date.now();
  const hrs = ms / 3_600_000;
  if (ms < 0) return { label: 'closed', variant: 'gray' };
  if (hrs < 24) return { label: `${Math.round(hrs)}h left`, variant: 'danger' };
  if (hrs < 72) return { label: `${Math.round(hrs / 24)}d left`, variant: 'warn' };
  return { label: `${Math.round(hrs / 24)}d left`, variant: 'success' };
}

export default function SourcingPage(): React.JSX.Element {
  const [tab, setTab] = useState<RfqTab>('active');
  const { data, isLoading } = useRfqList(tab);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Sourcing
          </h1>
          <p className="text-muted text-[13px]">
            Run competitive RFQs — sealed bids, two-envelope, reverse auction.
          </p>
        </div>
        <Link href="/sourcing/new">
          <Button variant="primary">New RFQ</Button>
        </Link>
      </div>

      <div className="border-line mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[13px] font-medium ${
              tab === t.key ? 'border-ink text-ink border-b-2' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="text-muted border-line border-b text-left">
            <tr>
              <th className="px-3 py-2 font-medium">RFQ</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 text-right font-medium">Est. value</th>
              <th className="px-3 py-2 text-center font-medium">Invited</th>
              <th className="px-3 py-2 text-center font-medium">Quotes</th>
              <th className="px-3 py-2 font-medium">Deadline</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="text-muted px-3 py-8 text-center">
                  Loading…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={9} className="text-muted px-3 py-8 text-center">
                  No RFQs in this tab.
                </td>
              </tr>
            )}
            {data?.items.map((r) => {
              const cd = countdown(r.bidDeadline);
              return (
                <tr
                  key={r.id}
                  className="border-line hover:bg-canvas border-b last:border-0"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/sourcing/${r.id}`}
                      className="text-accent font-mono text-[12px]"
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="text-muted px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2">
                    <Pill variant="gray">
                      {r.rfqType.replace('_', ' ').toLowerCase()}
                    </Pill>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {inr(r.estimatedValue)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{r.invitedCount}</td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {r.submittedCount}
                  </td>
                  <td className="px-3 py-2">
                    <Pill variant={cd.variant}>{cd.label}</Pill>
                  </td>
                  <td className="px-3 py-2">
                    <Pill variant={statusVariant(r.status)}>{statusLabel(r.status)}</Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
