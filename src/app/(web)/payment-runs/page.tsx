'use client';

import {
  BulkActionBar,
  Button,
  Checkbox,
  FilterBar,
  Input,
  PageHeader,
  Pill,
  SortableHead,
  SubNav,
  TableState,
  matchesFilters,
  optionsFrom,
  useFilters,
  useSelection,
  useSort,
  type FilterDef,
} from '@/components/ui';
import type { PaymentRunListItem } from '@/lib/shared';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { usePaymentRuns, type PaymentRunTab } from '@/lib/api/payments';
import { downloadCsv } from '@/lib/csv';
import { formatDate, inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: PaymentRunTab; label: string; countKey: keyof Counts }[] = [
  { key: 'all', label: 'All', countKey: 'all' },
  { key: 'draft', label: 'Draft', countKey: 'draft' },
  { key: 'awaiting', label: 'Awaiting approval', countKey: 'awaiting' },
  { key: 'submitted', label: 'Submitted', countKey: 'submitted' },
  { key: 'completed', label: 'Completed', countKey: 'completed' },
  { key: 'failed', label: 'Failed', countKey: 'failed' },
];
type Counts = {
  all: number;
  draft: number;
  awaiting: number;
  submitted: number;
  completed: number;
  failed: number;
};

type SortKey = 'number' | 'cycle' | 'items' | 'gross' | 'net';
const SORT: Record<SortKey, (r: PaymentRunListItem) => string | number> = {
  number: (r) => r.number,
  cycle: (r) => r.cycleDate,
  items: (r) => r.itemCount,
  gross: (r) => Number(r.gross),
  net: (r) => Number(r.net),
};

// No run filter is applied server-side beyond the tab.
function filterValue(r: PaymentRunListItem, key: string): string | number | null {
  switch (key) {
    case 'bank':
      return r.bankName ?? 'none';
    case 'composer':
      return r.composedByName ?? 'none';
    case 'status':
      return r.status;
    case 'cycle':
      return r.cycleDate;
    case 'net':
      return Number(r.net);
    case 'items':
      return r.itemCount;
    default:
      return null;
  }
}

export default function PaymentRunsPage(): React.JSX.Element {
  const [tab, setTab] = useState<PaymentRunTab>('all');
  const [search, setSearch] = useState('');
  const filters = useFilters();
  const { data, isLoading, error, refetch } = usePaymentRuns(tab);
  const counts = data?.counts;

  const items = useMemo(() => data?.items ?? [], [data]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'bank',
        label: 'Bank',
        type: 'select',
        options: [
          { value: 'none', label: 'No bank chosen' },
          // Runs carry the bank's name, not its id; the name is the key.
          ...optionsFrom(items, (r) =>
            r.bankName ? { value: r.bankName, label: r.bankName } : null,
          ),
        ],
      },
      {
        key: 'composer',
        label: 'Composer',
        type: 'select',
        options: optionsFrom(items, (r) =>
          r.composedByName ? { value: r.composedByName, label: r.composedByName } : null,
        ),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: optionsFrom(items, (r) => ({ value: r.status, label: statusLabel(r.status) })),
      },
      { key: 'cycle', label: 'Cycle date', type: 'date' },
      { key: 'net', label: 'Net amount', type: 'amount' },
      { key: 'items', label: 'Items', type: 'number' },
    ],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (r) =>
        (!q ||
          r.number.toLowerCase().includes(q) ||
          (r.name ?? '').toLowerCase().includes(q)) &&
        matchesFilters(r, defs, filters.values, filterValue),
    );
  }, [items, search, defs, filters.values]);

  const { sorted: rows, sort, toggle: toggleSort } = useSort(filtered, SORT);
  const selection = useSelection(rows.map((r) => r.id));
  const selectedRows = rows.filter((r) => selection.isSelected(r.id));
  const narrowed = search.trim() !== '' || filters.activeCount > 0;

  const exportSelected = (): void =>
    downloadCsv(`payment-runs-${tab}`, selectedRows, [
      { header: 'Run', value: (r) => r.number },
      { header: 'Name', value: (r) => r.name },
      { header: 'Cycle date', value: (r) => r.cycleDate.slice(0, 10) },
      { header: 'Status', value: (r) => statusLabel(r.status) },
      { header: 'Bank', value: (r) => r.bankName },
      { header: 'Items', value: (r) => r.itemCount },
      { header: 'Composer', value: (r) => r.composedByName },
      { header: 'Gross', value: (r) => r.gross },
      { header: 'Net', value: (r) => r.net },
      { header: 'Currency', value: (r) => r.currency },
    ]);

  const newRun = (variant: 'primary' | 'secondary'): React.JSX.Element => (
    <Button asChild variant={variant} size="sm">
      <Link href="/payment-runs/new">New payment run</Link>
    </Button>
  );

  return (
    <div className="pb-20">
      <PageHeader
        title="Payment runs"
        description="Compose, approve and submit bank files"
        actions={newRun('primary')}
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: counts?.[t.countKey] ?? 0,
        }))}
        value={tab}
        onChange={(k) => setTab(k as PaymentRunTab)}
      />

      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search run number or name…"
            aria-label="Search payment runs"
          />
        }
        summary={
          isLoading ? null : `${rows.length} shown${data?.truncated ? ' — first 2,000 loaded' : ''}`
        }
      />

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line text-muted border-b text-left">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  aria-label="Select all shown payment runs"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                  disabled={rows.length === 0}
                />
              </th>
              <SortableHead label="Run" sortKey="number" sort={sort} onSort={toggleSort} />
              <SortableHead label="Cycle date" sortKey="cycle" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2.5 text-caption font-medium">Bank</th>
              <th className="px-3 py-2.5 text-caption font-medium">Status</th>
              <th className="px-3 py-2.5 text-caption font-medium">Composer</th>
              <SortableHead
                label="Items"
                sortKey="items"
                sort={sort}
                onSort={toggleSort}
                numeric
              />
              <SortableHead
                label="Gross"
                sortKey="gross"
                sort={sort}
                onSort={toggleSort}
                numeric
              />
              <SortableHead label="Net" sortKey="net" sort={sort} onSort={toggleSort} numeric />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={9}
              isLoading={isLoading}
              error={error}
              isEmpty={rows.length === 0}
              onRetry={() => void refetch()}
              empty={
                narrowed
                  ? {
                      title: 'No payment runs match these filters',
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
                  : tab === 'all'
                    ? {
                        title: 'No payment runs yet',
                        detail:
                          'A run batches approved invoices into a single bank file for release.',
                        action: newRun('secondary'),
                      }
                    : {
                        title: 'Nothing in this view',
                        detail: 'No payment runs are in this state right now.',
                        action: tab === 'draft' ? newRun('secondary') : undefined,
                      }
              }
            />
            {rows.map((run) => {
              const isSel = selection.isSelected(run.id);
              return (
                <tr
                  key={run.id}
                  className={
                    'border-line duration-hover border-b transition-colors ' +
                    (isSel ? 'bg-accent-wash/60' : 'hover:bg-canvas/60')
                  }
                >
                  <td className="px-3 py-3.5">
                    <Checkbox
                      aria-label={`Select ${run.number}`}
                      checked={isSel}
                      onChange={() => selection.toggle(run.id)}
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <div>
                      <Link
                        href={`/payment-runs/${run.id}`}
                        className="font-numeric text-ink hover:text-accent font-medium"
                      >
                        {run.number}
                      </Link>
                      {/* Older runs were numbered with their name; don't print it twice. */}
                      {run.name && run.name !== run.number && (
                        <div className="text-faint text-micro">{run.name}</div>
                      )}
                    </div>
                  </td>
                  <td className="font-numeric text-text px-3 py-3.5 text-caption">
                    {formatDate(run.cycleDate)}
                  </td>
                  <td className="text-text px-3 py-3.5">{run.bankName ?? '—'}</td>
                  <td className="px-3 py-3.5">
                    <Pill variant={statusVariant(run.status)} dot>
                      {statusLabel(run.status)}
                    </Pill>
                  </td>
                  <td className="text-muted px-3 py-3.5">{run.composedByName ?? '—'}</td>
                  <td className="font-numeric text-text px-3 py-3.5 text-right">
                    {run.itemCount}
                  </td>
                  <td className="font-numeric text-muted px-3 py-3.5 text-right">
                    {inr(run.gross)}
                  </td>
                  <td className="font-numeric text-ink px-3 py-3.5 text-right font-medium">
                    {inr(run.net)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkActionBar
        count={selection.count}
        noun="payment run"
        onClear={selection.clear}
        note={
          // Deciding a run needs its approval id, which list rows do not carry.
          <Link href="/approvals" className="hover:text-white underline underline-offset-2">
            Approve or reject in Approvals
          </Link>
        }
      >
        <Button size="sm" variant="secondary" onClick={exportSelected}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      </BulkActionBar>
    </div>
  );
}
