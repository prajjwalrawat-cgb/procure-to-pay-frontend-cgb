'use client';

import { Button, PageHeader, Pill, TableState } from '@/components/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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

function countdown(
  deadline: string | null,
  now: number | null,
): { label: string; variant: 'success' | 'warn' | 'danger' | 'gray' } {
  if (!deadline) return { label: '—', variant: 'gray' };
  if (now === null) return { label: '…', variant: 'gray' };
  const ms = new Date(deadline).getTime() - now;
  const hrs = ms / 3_600_000;
  if (ms < 0) return { label: 'closed', variant: 'gray' };
  if (hrs < 24) return { label: `${Math.round(hrs)}h left`, variant: 'danger' };
  if (hrs < 72) return { label: `${Math.round(hrs / 24)}d left`, variant: 'warn' };
  return { label: `${Math.round(hrs / 24)}d left`, variant: 'success' };
}

export default function SourcingPage(): React.JSX.Element {
  const [tab, setTab] = useState<RfqTab>('active');
  const { data, isLoading, error, refetch } = useRfqList(tab);
  // The deadline countdown is relative to "now", which differs between the
  // server render and hydration. Computing only after mount keeps the two
  // trees identical, and refreshing each minute keeps the figure honest.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Sourcing"
        description="Run competitive RFQs — sealed bids, two-envelope, reverse auction."
        actions={
          <Link href="/sourcing/new">
            <Button variant="primary" size="sm">
              New RFQ
            </Button>
          </Link>
        }
      />

      <div className="border-line mb-4 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            type="button"
            className={`duration-hover shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
              tab === t.key
                ? 'border-accent text-ink'
                : 'text-muted hover:text-text border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="text-muted border-line border-b text-left">
            <tr>
              <th className="px-3 py-2 font-medium">RFQ</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Category</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">Type</th>
              <th className="px-3 py-2 text-right font-medium">Est. value</th>
              <th className="px-3 py-2 text-center font-medium">Invited</th>
              <th className="px-3 py-2 text-center font-medium">Quotes</th>
              <th className="px-3 py-2 font-medium">Deadline</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={9}
              isLoading={isLoading}
              error={error}
              isEmpty={(data?.items.length ?? 0) === 0}
              onRetry={() => void refetch()}
              empty={{
                title: 'No RFQs in this view',
                detail:
                  'Competitive events you run appear here from draft through award.',
                action:
                  tab === 'active' || tab === 'draft' ? (
                    <Link href="/sourcing/new">
                      <Button variant="primary" size="sm">
                        New RFQ
                      </Button>
                    </Link>
                  ) : undefined,
              }}
            />
            {data?.items.map((r) => {
              const cd = countdown(r.bidDeadline, now);
              return (
                <tr
                  key={r.id}
                  className="border-line hover:bg-canvas border-b last:border-0"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/sourcing/${r.id}`}
                      className="font-numeric text-ink text-[12px] font-medium hover:underline"
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="text-muted hidden px-3 py-2 md:table-cell">{r.category}</td>
                  <td className="px-3 py-2">
                    <Pill variant="gray">
                      {r.rfqType.replace('_', ' ').toLowerCase()}
                    </Pill>
                  </td>
                  <td className="font-numeric px-3 py-2 text-right">
                    {inr(r.estimatedValue)}
                  </td>
                  <td className="font-numeric px-3 py-2 text-center">{r.invitedCount}</td>
                  <td className="font-numeric px-3 py-2 text-center">
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
