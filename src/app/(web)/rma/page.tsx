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
import type { RmaListItem } from '@/lib/shared';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EntityRef } from '@/components/entity-ref';
import { useAllRmas, type RmaTab } from '@/lib/api/rma';
import { downloadCsv } from '@/lib/csv';
import { formatDate, humanise, inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: RmaTab; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'issued', label: 'Issued' },
  { key: 'awaiting_pickup', label: 'Awaiting pickup' },
  { key: 'awaiting_credit_note', label: 'Awaiting credit note' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

type SortKey = 'number' | 'vendor' | 'raised' | 'value';
const SORT: Record<SortKey, (r: RmaListItem) => string | number> = {
  number: (r) => r.number,
  vendor: (r) => r.vendor.name,
  raised: (r) => r.createdAt,
  value: (r) => Number(r.totalReturnValue),
};

function filterValue(r: RmaListItem, key: string): string | number | null {
  switch (key) {
    case 'vendor':
      return r.vendor.id;
    case 'reason':
      return r.reasonCode;
    case 'status':
      return r.status;
    case 'raised':
      return r.createdAt;
    case 'value':
      return Number(r.totalReturnValue);
    default:
      return null;
  }
}

export default function RmaListPage(): React.JSX.Element {
  const [tab, setTab] = useState<RmaTab>('all');
  const [search, setSearch] = useState('');
  const filters = useFilters();
  const { data, isLoading, error, refetch } = useAllRmas(tab);
  const counts = data?.counts;

  const items = useMemo(() => data?.items ?? [], [data]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'vendor',
        label: 'Vendor',
        type: 'select',
        options: optionsFrom(items, (r) => ({ value: r.vendor.id, label: r.vendor.name })),
      },
      {
        key: 'reason',
        label: 'Reason',
        type: 'select',
        options: optionsFrom(items, (r) => ({
          value: r.reasonCode,
          label: humanise(r.reasonCode),
        })),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: optionsFrom(items, (r) => ({ value: r.status, label: statusLabel(r.status) })),
      },
      { key: 'raised', label: 'Raised', type: 'date' },
      { key: 'value', label: 'Return value', type: 'amount' },
    ],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (r) =>
        (!q ||
          r.number.toLowerCase().includes(q) ||
          r.grn.number.toLowerCase().includes(q) ||
          r.vendor.name.toLowerCase().includes(q)) &&
        matchesFilters(r, defs, filters.values, filterValue),
    );
  }, [items, search, defs, filters.values]);

  const { sorted: rows, sort, toggle: toggleSort } = useSort(filtered, SORT);
  const selection = useSelection(rows.map((r) => r.id));
  const selectedRows = rows.filter((r) => selection.isSelected(r.id));
  const narrowed = search.trim() !== '' || filters.activeCount > 0;

  const exportSelected = (): void =>
    downloadCsv(`rma-${tab}`, selectedRows, [
      { header: 'RMA', value: (r) => r.number },
      { header: 'Vendor', value: (r) => r.vendor.name },
      { header: 'GRN', value: (r) => r.grn.number },
      { header: 'Reason', value: (r) => humanise(r.reasonCode) },
      { header: 'Status', value: (r) => statusLabel(r.status) },
      { header: 'Raised', value: (r) => r.createdAt.slice(0, 10) },
      { header: 'Return value', value: (r) => r.totalReturnValue },
      { header: 'Currency', value: (r) => r.currency },
    ]);

  return (
    <div className="pb-20">
      <PageHeader title="Return authorisations" description="Rejected-material returns" />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: counts?.[t.key] ?? 0,
        }))}
        value={tab}
        onChange={(k) => setTab(k as RmaTab)}
      />

      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search RMA, GRN or vendor…"
            aria-label="Search return authorisations"
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
                  aria-label="Select all shown return authorisations"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                  disabled={rows.length === 0}
                />
              </th>
              <SortableHead label="RMA" sortKey="number" sort={sort} onSort={toggleSort} />
              <SortableHead label="Vendor" sortKey="vendor" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2.5 text-caption font-medium">GRN</th>
              <th className="px-3 py-2.5 text-caption font-medium">Reason</th>
              <SortableHead label="Raised" sortKey="raised" sort={sort} onSort={toggleSort} />
              <SortableHead
                label="Return value"
                sortKey="value"
                sort={sort}
                onSort={toggleSort}
                numeric
              />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={7}
              isLoading={isLoading}
              error={error}
              isEmpty={rows.length === 0}
              onRetry={() => void refetch()}
              empty={
                narrowed
                  ? {
                      title: 'No return authorisations match these filters',
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
                        title: 'No return authorisations yet',
                        detail:
                          'An RMA is raised from a goods receipt when QC rejects material, to send it back to the supplier and claim a credit note.',
                        action: (
                          <Button asChild variant="secondary" size="sm">
                            <Link href="/goods-receipt">Go to receipts</Link>
                          </Button>
                        ),
                      }
                    : {
                        title: 'Nothing in this view',
                        detail: 'No return authorisations are in this state right now.',
                      }
              }
            />
            {rows.map((r) => {
              const isSel = selection.isSelected(r.id);
              return (
                <tr
                  key={r.id}
                  className={
                    'border-line duration-hover border-b transition-colors ' +
                    (isSel ? 'bg-accent-wash/60' : 'hover:bg-canvas/60')
                  }
                >
                  <td className="px-3 py-3.5">
                    <Checkbox
                      aria-label={`Select ${r.number}`}
                      checked={isSel}
                      onChange={() => selection.toggle(r.id)}
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <div>
                      <Link
                        href={`/rma/${r.id}`}
                        className="font-numeric text-ink hover:text-accent font-medium"
                      >
                        {r.number}
                      </Link>
                      <div className="mt-0.5">
                        <Pill variant={statusVariant(r.status)} dot>
                          {statusLabel(r.status)}
                        </Pill>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <EntityRef kind="vendor" id={r.vendor.id}>
                      {r.vendor.name}
                    </EntityRef>
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-caption">
                    <Link href={`/goods-receipt/${r.grn.id}`} className="text-text hover:text-accent">
                      {r.grn.number}
                    </Link>
                  </td>
                  <td className="text-muted px-3 py-3.5 text-caption">{humanise(r.reasonCode)}</td>
                  <td className="font-numeric text-text px-3 py-3.5 text-caption">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="font-numeric text-ink px-3 py-3.5 text-right font-medium">
                    {inr(r.totalReturnValue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkActionBar count={selection.count} noun="RMA" onClear={selection.clear}>
        <Button size="sm" variant="secondary" onClick={exportSelected}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      </BulkActionBar>
    </div>
  );
}
