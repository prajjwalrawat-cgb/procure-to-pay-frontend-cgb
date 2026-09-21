'use client';

import type { ContractListItem, ContractTab } from '@/lib/shared';
import {
  Badge,
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
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useAllContracts } from '@/lib/api/contracts';
import { formatDate, inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: ContractTab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'awaiting_approval', label: 'Awaiting approval' },
  { key: 'expiring_soon', label: 'Expiring soon' },
  { key: 'expired', label: 'Expired' },
  { key: 'terminated', label: 'Terminated' },
];

const TYPE_LABEL: Record<string, string> = {
  RATE_CONTRACT: 'Rate contract',
  FRAMEWORK_AGREEMENT: 'Framework agreement',
  BLANKET_PO: 'Blanket PO',
  SERVICE_AGREEMENT: 'Service agreement',
};

type Cmp = (a: ContractListItem, b: ContractListItem) => number;
const cmpBy =
  (get: (c: ContractListItem) => string | number, dir: 1 | -1): Cmp =>
  (a, b) => {
    const x = get(a);
    const y = get(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  };

/**
 * A card grid has no column headers to click, so sorting is a picker with a
 * fixed, useful direction per field. Expiry first: "what runs out next" is the
 * question a contract list is usually opened to answer.
 */
const SORTS = {
  expiry: { label: 'Expiry — soonest', cmp: cmpBy((c) => c.validityEnd, 1) },
  value: { label: 'Committed value — highest', cmp: cmpBy((c) => Number(c.totalValueEstimate), -1) },
  start: { label: 'Newest start date', cmp: cmpBy((c) => c.validityStart, -1) },
  title: { label: 'Title A–Z', cmp: (a: ContractListItem, b: ContractListItem) => a.title.localeCompare(b.title) },
} satisfies Record<string, { label: string; cmp: Cmp }>;
type SortKey = keyof typeof SORTS;

function filterValue(c: ContractListItem, key: string): string | number | null {
  switch (key) {
    case 'vendor':
      return c.vendor.id;
    case 'type':
      return c.contractType;
    case 'category':
      return c.category;
    case 'status':
      return c.status;
    case 'value':
      return Number(c.totalValueEstimate);
    case 'validTo':
      return c.validityEnd;
    default:
      return null;
  }
}

/**
 * Contracts as a card grid.
 *
 * Both patterns were tried against this data. A contract is chosen by
 * comparison — which agreement covers this spend, whose rate card applies,
 * what is still in validity — and the two facts that decide it (committed
 * value and time left to run) need to sit together, which a row spreads across
 * columns five and six. The list is also short by nature: a tenant has tens of
 * contracts, not thousands, so the density argument for a table does not apply
 * the way it does to purchase orders.
 */
export default function ContractsPage(): React.JSX.Element {
  const [tab, setTab] = useState<ContractTab>('active');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('expiry');
  const filters = useFilters();
  const { data, isLoading, error, refetch } = useAllContracts(tab);
  const counts = data?.counts;

  const items = useMemo(() => data?.items ?? [], [data]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'vendor',
        label: 'Vendor',
        type: 'select',
        options: optionsFrom(items, (c) => ({ value: c.vendor.id, label: c.vendor.name })),
      },
      {
        key: 'type',
        label: 'Contract type',
        type: 'select',
        options: optionsFrom(items, (c) => ({
          value: c.contractType,
          label: TYPE_LABEL[c.contractType] ?? c.contractType,
        })),
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: optionsFrom(items, (c) => ({ value: c.category, label: c.category })),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: optionsFrom(items, (c) => ({ value: c.status, label: statusLabel(c.status) })),
      },
      { key: 'value', label: 'Committed value', type: 'amount' },
      { key: 'validTo', label: 'Valid to', type: 'date' },
    ],
    [items],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(
        (c) =>
          (!q ||
            c.title.toLowerCase().includes(q) ||
            c.number.toLowerCase().includes(q) ||
            c.vendor.name.toLowerCase().includes(q)) &&
          matchesFilters(c, defs, filters.values, filterValue),
      )
      .sort(SORTS[sortKey].cmp);
  }, [items, search, defs, filters.values, sortKey]);

  const narrowed = search.trim() !== '' || filters.activeCount > 0;

  const newContract = (variant: 'primary' | 'secondary'): React.JSX.Element => (
    <Button asChild variant={variant} size="sm">
      <Link href="/contracts/new">
        <Plus className="h-3.5 w-3.5" aria-hidden /> New contract
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Rate contracts, framework agreements and call-offs."
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link href="/contracts/clause-library">Clause library</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/contracts/renewals">Renewal calendar</Link>
            </Button>
            {newContract('primary')}
          </>
        }
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({ key: t.key, label: t.label, count: counts?.[t.key] }))}
        value={tab}
        onChange={(k) => setTab(k as ContractTab)}
      />

      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, number or vendor…"
            aria-label="Search contracts"
          />
        }
        summary={
          isLoading ? null : `${rows.length} shown${data?.truncated ? ' — first 2,000 loaded' : ''}`
        }
        actions={
          <Select
            aria-label="Sort contracts"
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
                title: 'No contracts match these filters',
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
                  title: tab === 'active' ? 'No active contracts' : 'No draft contracts',
                  detail:
                    'Agreements you sign with suppliers appear here with their rate card, committed value and validity, and can be called off against directly.',
                  action: newContract('secondary'),
                }
              : {
                  title: 'Nothing in this view',
                  detail: 'No contracts are in this state right now.',
                }
        }
      >
        {/* grid-cols-1 = minmax(0, 1fr): without it the single phone column
            sizes to the longest (truncated) title and pushes cards off-screen. */}
        <CardGrid className="grid-cols-1">
          {rows.map((c) => {
            const expiringSoon = c.daysToExpiry >= 0 && c.daysToExpiry <= 90;
            return (
              <Card key={c.id} interactive>
                <CardHeader
                  badge={
                    <StatusText variant={statusVariant(c.status)}>
                      {statusLabel(c.status)}
                    </StatusText>
                  }
                >
                  <CardTitle>
                    <Link href={`/contracts/${c.id}`} className="hover:text-accent">
                      {c.title}
                    </Link>
                  </CardTitle>
                  <CardMeta>
                    <span className="font-numeric">{c.number}</span>
                    <span className="text-faint"> — {c.vendor.name}</span>
                  </CardMeta>
                </CardHeader>

                <div className="flex items-end justify-between gap-3 px-4 pb-3">
                  <div className="min-w-0">
                    <p className="text-faint text-micro">Committed value</p>
                    <p className="font-numeric text-ink text-body-sm font-medium">
                      {inr(c.totalValueEstimate, 0)}
                    </p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-faint text-micro">Valid to</p>
                    {expiringSoon ? (
                      <StatusText variant="warn" className="text-body-sm">
                        {c.daysToExpiry}d left
                      </StatusText>
                    ) : (
                      <p className="font-numeric text-ink text-body-sm font-medium">
                        {formatDate(c.validityEnd)}
                      </p>
                    )}
                  </div>
                </div>

                <CardFooter
                  action={
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/contracts/${c.id}`}>Open contract</Link>
                    </Button>
                  }
                >
                  <Badge variant="neutral">{TYPE_LABEL[c.contractType] ?? c.contractType}</Badge>
                </CardFooter>
              </Card>
            );
          })}
        </CardGrid>
      </DataState>
    </div>
  );
}
