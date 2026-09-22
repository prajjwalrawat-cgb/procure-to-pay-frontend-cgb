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
  FilterBar,
  Input,
  PageHeader,
  Select,
  SkeletonCards,
  StatusText,
  SubNav,
  matchesFilters,
  optionsFrom,
  useFilters,
  type FilterDef,
} from '@/components/ui';
import type { RfqListItem } from '@/lib/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useAllRfqs, type RfqTab } from '@/lib/api/sourcing';
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
 * A card grid has no column headers to click, so sorting is a picker. Each
 * option is a fixed direction — the useful end of that field — rather than a
 * toggle nobody can see the state of.
 */
const SORTS = {
  deadline: { label: 'Deadline — soonest', cmp: byNullable((r) => r.bidDeadline, 1) },
  newest: { label: 'Newest first', cmp: byNullable((r) => r.createdAt, -1) },
  value: { label: 'Estimated value — highest', cmp: byNullable((r) => Number(r.estimatedValue), -1) },
  quotes: { label: 'Quotes received — most', cmp: byNullable((r) => r.submittedCount, -1) },
} satisfies Record<string, { label: string; cmp: (a: RfqListItem, b: RfqListItem) => number }>;
type SortKey = keyof typeof SORTS;

/** Ascending (1) or descending (-1) on one field; missing values always sink. */
function byNullable(
  get: (r: RfqListItem) => string | number | null,
  dir: 1 | -1,
): (a: RfqListItem, b: RfqListItem) => number {
  return (a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  };
}

function filterValue(r: RfqListItem, key: string): string | number | null {
  switch (key) {
    case 'category':
      return r.category;
    case 'rfqType':
      return r.rfqType;
    case 'status':
      return r.status;
    case 'value':
      return Number(r.estimatedValue);
    case 'deadline':
      return r.bidDeadline;
    default:
      return null;
  }
}

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
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('deadline');
  const filters = useFilters();
  const { data, isLoading, error, refetch } = useAllRfqs(tab);
  // The deadline countdown is relative to "now", which differs between the
  // server render and hydration. Computing only after mount keeps the two
  // trees identical, and refreshing each minute keeps the figure honest.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo(() => data?.items ?? [], [data]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: optionsFrom(items, (r) => ({ value: r.category, label: r.category })),
      },
      {
        key: 'rfqType',
        label: 'Event type',
        type: 'select',
        options: optionsFrom(items, (r) => ({ value: r.rfqType, label: rfqTypeLabel(r.rfqType) })),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: optionsFrom(items, (r) => ({ value: r.status, label: statusLabel(r.status) })),
      },
      { key: 'value', label: 'Estimated value', type: 'amount' },
      { key: 'deadline', label: 'Bid deadline', type: 'date' },
    ],
    [items],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        (r) =>
          (!q ||
            r.title.toLowerCase().includes(q) ||
            r.number.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q)) &&
          matchesFilters(r, defs, filters.values, filterValue),
      )
      .sort(SORTS[sortKey].cmp);
  }, [items, search, defs, filters.values, sortKey]);

  const narrowed = search.trim() !== '' || filters.activeCount > 0;

  const newRfq = (variant: 'primary' | 'secondary'): React.JSX.Element => (
    <Button asChild variant={variant} size="sm">
      <Link href="/sourcing/new">New RFQ</Link>
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Sourcing"
        description="Run competitive RFQs — sealed bids, two-envelope, reverse auction."
        actions={newRfq('primary')}
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label }))}
        value={tab}
        onChange={(k) => setTab(k as RfqTab)}
      />

      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, number or category…"
            aria-label="Search RFQs"
          />
        }
        summary={
          isLoading ? null : `${rows.length} shown${data?.truncated ? ' — first 2,000 loaded' : ''}`
        }
        actions={
          <Select
            aria-label="Sort RFQs"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 w-auto"
          >
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORTS[k].label}
              </option>
            ))}
          </Select>
        }
      />

      <DataState
        isLoading={isLoading}
        loading={<SkeletonCards />}
        error={error}
        isEmpty={rows.length === 0}
        onRetry={() => void refetch()}
        empty={
          narrowed
            ? {
                title: 'No RFQs match these filters',
                detail: 'Clear a filter or change the search to see more.',
                action: (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      filters.clear();
                      setSearch('');
                    }}
                  >
                    Clear filters
                  </Button>
                ),
              }
            : tab === 'active' || tab === 'draft'
              ? {
                  title: tab === 'active' ? 'No live RFQs' : 'No draft RFQs',
                  detail:
                    'Competitive events you launch appear here through award — invited suppliers, quotes received and time left to bid.',
                  action: newRfq('secondary'),
                }
              : {
                  title: 'Nothing in this view',
                  detail: 'No RFQs are in this state right now.',
                }
        }
      >
        {/* grid-cols-1 = minmax(0, 1fr): without it the single phone column
            sizes to the longest (truncated) title and pushes cards off-screen. */}
        <CardGrid className="grid-cols-1">
          {rows.map((r) => {
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
                  <CardTitle>
                    <Link href={`/sourcing/${r.id}`} className="hover:text-accent">
                      {r.title}
                    </Link>
                  </CardTitle>
                  <CardMeta>
                    <span className="font-numeric">{r.number}</span>
                    <span className="text-faint"> — {r.category}</span>
                  </CardMeta>
                </CardHeader>

                <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 pb-3">
                  <Figure label="Estimated value" value={inr(r.estimatedValue, 0)} />
                  <Figure
                    label="Quotes in"
                    value={`${r.submittedCount} of ${r.invitedCount}`}
                  />
                  <div className="min-w-0">
                    <p className="text-faint text-micro">Bid deadline</p>
                    <StatusText variant={cd.variant} className="text-body-sm">
                      {cd.label}
                    </StatusText>
                  </div>
                </div>

                <CardFooter
                  action={
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/sourcing/${r.id}`}>Open RFQ</Link>
                    </Button>
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
      <p className="text-faint text-micro">{label}</p>
      <p className="font-numeric text-ink truncate text-body-sm font-medium">{value}</p>
    </div>
  );
}
