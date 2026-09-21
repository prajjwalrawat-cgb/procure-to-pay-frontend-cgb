'use client';

import {
  Badge,
  BulkActionBar,
  Button,
  Checkbox,
  ExpandToggle,
  FilterBar,
  Input,
  PageHeader,
  StatusText,
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
import type { PoListItem } from '@/lib/shared';
import { Download, Plus } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';

import { EntityRef } from '@/components/entity-ref';
import { billingLabel, receiptLabel } from '@/components/purchase-orders/fulfilment';
import { PoRowDetail } from '@/components/purchase-orders/po-row-detail';
import { usePurchaseOrders, type PoTab } from '@/lib/api/purchase-orders';
import { downloadCsv } from '@/lib/csv';
import { formatDate, humanise, inr, statusLabel, statusVariant } from '@/lib/format';
import { useInitialTab } from '@/lib/use-initial-tab';

const TABS: { key: PoTab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'partial', label: 'Partial' },
  { key: 'awaiting_grn', label: 'Awaiting GRN' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PROGRESS_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'COMPLETE', label: 'Complete' },
];

type SortKey = 'number' | 'vendor' | 'fulfilment' | 'expected' | 'amount';
const SORT: Record<SortKey, (p: PoListItem) => string | number | null> = {
  number: (p) => p.number,
  vendor: (p) => p.vendor.name,
  fulfilment: (p) => p.fulfilmentPct,
  expected: (p) => p.expectedDeliveryDate,
  amount: (p) => Number(p.totalAmount),
};

// The API accepts costCenterId / amount / fulfilment params but ignores them,
// so every filter here runs over the loaded rows.
function filterValue(p: PoListItem, key: string): string | number | null {
  switch (key) {
    case 'vendor':
      return p.vendor.id;
    case 'costCenter':
      return p.costCenter?.id ?? 'none';
    case 'poType':
      return p.poType;
    case 'status':
      return p.status;
    case 'receipt':
      return p.fulfilment.receipt;
    case 'billing':
      return p.fulfilment.billing;
    case 'amount':
      return Number(p.totalAmount);
    case 'expected':
      return p.expectedDeliveryDate;
    default:
      return null;
  }
}

export default function PurchaseOrdersPage(): React.JSX.Element {
  const [tab, setTab] = useState<PoTab>('open');
  useInitialTab(TABS.map((t) => t.key), setTab);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const filters = useFilters();
  const { data, isLoading, error, refetch } = usePurchaseOrders(tab);
  const counts = data?.counts;

  const items = useMemo(() => data?.items ?? [], [data]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'vendor',
        label: 'Vendor',
        type: 'select',
        options: optionsFrom(items, (p) => ({ value: p.vendor.id, label: p.vendor.name })),
      },
      {
        key: 'costCenter',
        label: 'Cost centre',
        type: 'select',
        options: [
          { value: 'none', label: 'No cost centre' },
          ...optionsFrom(items, (p) =>
            p.costCenter
              ? { value: p.costCenter.id, label: `${p.costCenter.code} — ${p.costCenter.name}` }
              : null,
          ),
        ],
      },
      {
        key: 'poType',
        label: 'PO type',
        type: 'select',
        options: optionsFrom(items, (p) => ({ value: p.poType, label: humanise(p.poType) })),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: optionsFrom(items, (p) => ({ value: p.status, label: statusLabel(p.status) })),
      },
      { key: 'receipt', label: 'Receipt', type: 'select', options: PROGRESS_OPTIONS },
      {
        key: 'billing',
        label: 'Billing',
        type: 'select',
        options: [...PROGRESS_OPTIONS, { value: 'OVER', label: 'Over-invoiced' }],
      },
      { key: 'amount', label: 'Value', type: 'amount' },
      { key: 'expected', label: 'Expected delivery', type: 'date' },
    ],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (p) =>
        (!q ||
          p.number.toLowerCase().includes(q) ||
          p.vendor.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)) &&
        matchesFilters(p, defs, filters.values, filterValue),
    );
  }, [items, search, defs, filters.values]);

  const { sorted: rows, sort, toggle: toggleSort } = useSort(filtered, SORT);
  const selection = useSelection(rows.map((r) => r.id));
  const selectedRows = rows.filter((r) => selection.isSelected(r.id));
  const narrowed = search.trim() !== '' || filters.activeCount > 0;

  const exportSelected = (): void =>
    downloadCsv(`purchase-orders-${tab}`, selectedRows, [
      { header: 'PO', value: (p) => p.number },
      { header: 'Vendor', value: (p) => p.vendor.name },
      { header: 'MSME', value: (p) => (p.vendor.isMsme ? 'Yes' : 'No') },
      { header: 'Description', value: (p) => p.description },
      { header: 'Cost centre', value: (p) => p.costCenter?.code },
      { header: 'PO type', value: (p) => humanise(p.poType) },
      { header: 'Status', value: (p) => statusLabel(p.status) },
      { header: 'Receipt', value: (p) => receiptLabel(p.fulfilment) },
      { header: 'Billing', value: (p) => billingLabel(p.fulfilment) },
      { header: 'Received %', value: (p) => p.fulfilment.receivedPct.toFixed(0) },
      { header: 'Billed %', value: (p) => p.fulfilment.billedPct.toFixed(0) },
      { header: 'Expected delivery', value: (p) => p.expectedDeliveryDate?.slice(0, 10) },
      { header: 'Acknowledged', value: (p) => (p.acknowledged ? 'Yes' : 'No') },
      { header: 'Amount', value: (p) => p.totalAmount },
      { header: 'Currency', value: (p) => p.currency },
    ]);

  const newPo = (
    // Spot buy — no requisition behind it; see /purchase-orders/new.
    <Button asChild variant="primary" size="sm">
      <Link href="/purchase-orders/new">
        <Plus className="h-3.5 w-3.5" aria-hidden /> New PO
      </Link>
    </Button>
  );

  return (
    <div className="pb-20">
      <PageHeader title="Purchase orders" description="Issued and in-flight orders." actions={newPo} />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: counts?.[t.key] ?? 0,
        }))}
        value={tab}
        onChange={(k) => {
          setTab(k as PoTab);
          // The expanded order belongs to the tab just left.
          setExpanded(null);
        }}
      />

      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, vendor or description…"
            aria-label="Search purchase orders"
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
                  aria-label="Select all shown purchase orders"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                  disabled={rows.length === 0}
                />
              </th>
              <th className="w-8 px-1 py-2.5" />
              <SortableHead label="PO" sortKey="number" sort={sort} onSort={toggleSort} />
              <SortableHead label="Vendor" sortKey="vendor" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2.5 text-caption font-medium">Description</th>
              <th className="px-3 py-2.5 text-caption font-medium">Cost centre</th>
              <SortableHead
                label="Received"
                sortKey="fulfilment"
                sort={sort}
                onSort={toggleSort}
                numeric
              />
              <SortableHead
                label="Expected"
                sortKey="expected"
                sort={sort}
                onSort={toggleSort}
                numeric
              />
              <SortableHead label="Value" sortKey="amount" sort={sort} onSort={toggleSort} numeric />
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
                      title: 'No purchase orders match these filters',
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
                  : tab === 'open'
                    ? {
                        title: 'No open purchase orders',
                        detail:
                          'Approved requisitions become orders here, along with any spot buys you raise directly.',
                        action: newPo,
                      }
                    : {
                        title: 'Nothing in this view',
                        detail: 'Orders reach this view as they move through their lifecycle.',
                      }
              }
            />
            {rows.map((po) => {
              const isOpen = expanded === po.id;
              const isSel = selection.isSelected(po.id);
              return (
                <Fragment key={po.id}>
                  <tr
                    className={
                      'border-line duration-hover border-b transition-colors ' +
                      (isSel ? 'bg-accent-wash/60' : isOpen ? 'bg-canvas' : 'hover:bg-canvas/60')
                    }
                  >
                    <td className="px-3 py-3.5">
                      <Checkbox
                        aria-label={`Select ${po.number}`}
                        checked={isSel}
                        onChange={() => selection.toggle(po.id)}
                      />
                    </td>
                    <td className="px-1 py-3.5">
                      <ExpandToggle
                        open={isOpen}
                        label={po.number}
                        onToggle={() => setExpanded(isOpen ? null : po.id)}
                      />
                    </td>
                    <td className="px-3 py-3.5">
                      <div>
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="font-numeric text-ink hover:text-accent font-medium"
                        >
                          {po.number}
                        </Link>
                        <div className="mt-0.5">
                          <StatusText variant={statusVariant(po.status)}>
                            {statusLabel(po.status)}
                          </StatusText>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span>
                        <EntityRef kind="vendor" id={po.vendor.id}>
                          {po.vendor.name}
                        </EntityRef>
                        {po.vendor.isMsme && (
                          <Badge variant="classification" className="ml-1.5">
                            MSME
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="text-muted max-w-[280px] px-3 py-3.5 text-caption">
                      <span className="line-clamp-2">{po.description || '—'}</span>
                    </td>
                    <td className="text-muted px-3 py-3.5 text-caption">
                      {po.costCenter ? (
                        <span title={po.costCenter.name}>{po.costCenter.code}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      <Fulfilment po={po} />
                    </td>
                    <td className="font-numeric text-text px-3 py-3.5 text-right text-caption">
                      {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '—'}
                    </td>
                    <td className="font-numeric text-ink px-3 py-3.5 text-right font-medium">
                      {inr(po.totalAmount)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <PoRowDetail id={po.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkActionBar
        count={selection.count}
        noun="order"
        onClear={selection.clear}
        note={
          // Approving a PO needs its approval id, which list rows do not
          // carry — the Approvals queue is where orders are decided in bulk.
          <Link href="/inbox" className="hover:text-white underline underline-offset-2">
            Approve or reject in your Approvals inbox
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

/**
 * Fulfilment against the order, as a figure.
 *
 * This started as a progress bar and was wrong twice over. An empty track at 0%
 * is ambiguous — it reads as "no data" as easily as "nothing has arrived" —
 * and spelling that out in words instead put the same sentence on all sixteen
 * rows, which is a column of noise you learn to skip.
 *
 * A percentage in the numeric column solves both: 0% is unambiguous, the
 * figures align down the page, and the eye can find the one order that is
 * part-received without reading anything. Only 100% takes colour, because
 * "done" is the state you scan for; everything short of it is just progress.
 * Billing sits underneath only once something has been invoiced, and only
 * over-invoicing is coloured.
 */
function Fulfilment({ po }: { po: PoListItem }): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, po.fulfilmentPct));
  const billing = po.fulfilment.billing;
  return (
    <span className="inline-flex flex-col items-end">
      <span className={clamped >= 100 ? 'text-success font-medium' : 'text-muted'}>
        {clamped.toFixed(0)}%
      </span>
      {billing !== 'NONE' && (
        <span className={'text-micro ' + (billing === 'OVER' ? 'text-warn' : 'text-faint')}>
          {billing === 'OVER' ? 'over-invoiced' : `${po.fulfilment.billedPct.toFixed(0)}% billed`}
        </span>
      )}
    </span>
  );
}
