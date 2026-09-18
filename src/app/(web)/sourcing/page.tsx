'use client';

import {
  Button,
  Card,
  CardFooter,
  CardGrid,
  CardHeader,
  CardMeta,
  CardTitle,
  DataState,
  PageHeader,
  StatusText,
  SubNav,
} from '@/components/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useRfqList, type RfqTab } from '@/lib/api/sourcing';
import { formatDate, inr, statusLabel, statusVariant, type PillVariant } from '@/lib/format';

const TABS: { key: RfqTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'my_action', label: 'Awaiting my action' },
  { key: 'evaluation', label: 'Under evaluation' },
  { key: 'awarded', label: 'Awarded' },
  { key: 'cancelled', label: 'Cancelled' },
];

/**
 * How long is left to bid, and whether that is a problem.
 *
 * Only the last day is red. An RFQ with a week to run is not an exception, and
 * colouring it green implied the opposite — that time remaining was an
 * achievement rather than the normal state.
 */
function countdown(
  deadline: string | null,
  now: number | null,
): { label: string; variant: PillVariant } {
  if (!deadline) return { label: 'No deadline set', variant: 'neutral' };
  if (now === null) return { label: '…', variant: 'neutral' };
  const ms = new Date(deadline).getTime() - now;
  const hrs = ms / 3_600_000;
  if (ms < 0) return { label: 'Bidding closed', variant: 'neutral' };
  if (hrs < 24) return { label: `${Math.round(hrs)}h left`, variant: 'danger' };
  if (hrs < 72) return { label: `${Math.round(hrs / 24)}d left`, variant: 'warn' };
  return { label: `${Math.round(hrs / 24)}d left`, variant: 'neutral' };
}

/** `TWO_ENVELOPE` → `Two envelope` */
function rfqTypeLabel(t: string): string {
  const s = t.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Sourcing is a card grid, not a table.
 *
 * An RFQ is a live event you compare against its siblings — how many suppliers
 * were invited, how many have actually quoted, how long is left. Those three
 * numbers next to each other are the whole job, and they were previously spread
 * across a nine-column row where the quote count sat between "Invited" and
 * "Deadline" as an anonymous integer. The card grid also matches the
 * supplier-comparison view inside an RFQ, so the pattern is consistent from
 * list to evaluation.
 */
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
    <div>
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

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={tab}
        onChange={(k) => setTab(k as RfqTab)}
      />

      <DataState
        isLoading={isLoading}
        error={error}
        isEmpty={(data?.items.length ?? 0) === 0}
        onRetry={() => void refetch()}
        empty={{
          title: 'No RFQs yet',
          detail:
            'Competitive events you launch appear here through award — invited suppliers, quotes received and time left to bid.',
          action:
            tab === 'active' || tab === 'draft' ? (
              <Link href="/sourcing/new">
                <Button variant="primary" size="sm">
                  New RFQ
                </Button>
              </Link>
            ) : undefined,
        }}
      >
        <CardGrid>
          {data?.items.map((r) => {
            const cd = countdown(r.bidDeadline, now);
            return (
              <Card key={r.id} interactive>
                <CardHeader
                  badge={
                    <StatusText variant={statusVariant(r.status)}>
                      {statusLabel(r.status)}
                    </StatusText>
                  }
                >
                  <CardTitle>{r.title}</CardTitle>
                  <CardMeta>
                    <span className="font-numeric">{r.number}</span>
                    <span className="text-faint"> — {r.category}</span>
                  </CardMeta>
                </CardHeader>

                <div className="grid grid-cols-3 gap-3 px-4 pb-3">
                  <Figure label="Estimated value" value={inr(r.estimatedValue, 0)} />
                  <Figure
                    label="Quotes in"
                    value={`${r.submittedCount} of ${r.invitedCount}`}
                  />
                  <div className="min-w-0">
                    <p className="text-faint text-[11px]">Bid deadline</p>
                    <StatusText variant={cd.variant} className="text-[13px]">
                      {cd.label}
                    </StatusText>
                  </div>
                </div>

                <CardFooter
                  action={
                    <Link href={`/sourcing/${r.id}`}>
                      <Button variant="secondary" size="sm">
                        Open RFQ
                      </Button>
                    </Link>
                  }
                >
                  {rfqTypeLabel(r.rfqType)}
                  {r.bidDeadline ? ` — closes ${formatDate(r.bidDeadline)}` : ''}
                </CardFooter>
              </Card>
            );
          })}
        </CardGrid>
      </DataState>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-faint text-[11px]">{label}</p>
      <p className="font-numeric text-ink truncate text-[13px] font-medium">{value}</p>
    </div>
  );
}
