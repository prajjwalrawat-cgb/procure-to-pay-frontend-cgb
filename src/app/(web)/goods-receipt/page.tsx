'use client';

import {
  Badge,
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
import type { GrnListItem, PoListItem } from '@/lib/shared';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EntityRef } from '@/components/entity-ref';
import { usePurchaseOrders } from '@/lib/api/purchase-orders';
import { useReceipts, type GrnTab } from '@/lib/api/receipts';
import { downloadCsv } from '@/lib/csv';
import { formatDate, humanise, inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: GrnTab; label: string }[] = [
  { key: 'pending_receipt', label: 'Pending receipt' },
  { key: 'awaiting_qc', label: 'Awaiting QC' },
  { key: 'posted_today', label: 'Posted today' },
  { key: 'held', label: 'Held' },
  { key: 'all', label: 'All' },
];

type ReceiptTab = Exclude<GrnTab, 'pending_receipt'>;

export default function GoodsReceiptPage(): React.JSX.Element {
  const [tab, setTab] = useState<GrnTab>('pending_receipt');
  // Pending receipt is purchase orders, not GRNs: the same endpoint the PO
  // list's "Awaiting GRN" tab reads, fetched in full so it sorts honestly.
  const pending = usePurchaseOrders('awaiting_grn');
  // On the pending tab this still runs, for the other tabs' counts.
  const receipts = useReceipts(tab);
  const counts = receipts.data?.counts;

  return (
    <div className="pb-20">
      <PageHeader
        title="Receipts"
        description="Goods receipt & QC"
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/goods-receipt/new">New receipt</Link>
          </Button>
        }
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count:
            t.key === 'pending_receipt'
              ? (pending.data?.counts.awaiting_grn ?? 0)
              : (counts?.[t.key] ?? 0),
        }))}
        value={tab}
        onChange={(k) => setTab(k as GrnTab)}
      />

      {tab === 'pending_receipt' ? (
        <PendingReceiptTable
          items={pending.data?.items ?? []}
          truncated={!!pending.data?.truncated}
          isLoading={pending.isLoading}
          error={pending.error}
          onRetry={() => void pending.refetch()}
        />
      ) : (
        // Keyed on the tab so selection, search and filters start fresh.
        <ReceiptsTable
          key={tab}
          tab={tab}
          items={receipts.data?.items ?? []}
          truncated={!!receipts.data?.truncated}
          isLoading={receipts.isLoading}
          error={receipts.error}
          onRetry={() => void receipts.refetch()}
        />
      )}
    </div>
  );
}

interface ListProps<T> {
  items: T[];
  truncated: boolean;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

const shownSummary = (isLoading: boolean, n: number, truncated: boolean): string | null =>
  isLoading ? null : `${n} shown${truncated ? ' — first 2,000 loaded' : ''}`;

function clearButton(onClear: () => void): React.JSX.Element {
  return (
    <Button variant="secondary" size="sm" onClick={onClear}>
      Clear filters
    </Button>
  );
}

// ── Pending receipt (purchase orders with quantity outstanding) ─────────────

type PendingSortKey = 'number' | 'vendor' | 'expected' | 'amount';
const PENDING_SORT: Record<PendingSortKey, (p: PoListItem) => string | number | null> = {
  number: (p) => p.number,
  vendor: (p) => p.vendor.name,
  expected: (p) => p.expectedDeliveryDate,
  amount: (p) => Number(p.totalAmount),
};

function pendingValue(p: PoListItem, key: string): string | number | null {
  if (key === 'vendor') return p.vendor.id;
  if (key === 'expected') return p.expectedDeliveryDate;
  if (key === 'amount') return Number(p.totalAmount);
  return null;
}

function PendingReceiptTable({
  items,
  truncated,
  isLoading,
  error,
  onRetry,
}: ListProps<PoListItem>): React.JSX.Element {
  const [search, setSearch] = useState('');
  const filters = useFilters();

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'vendor',
        label: 'Vendor',
        type: 'select',
        options: optionsFrom(items, (p) => ({ value: p.vendor.id, label: p.vendor.name })),
      },
      { key: 'expected', label: 'Expected delivery', type: 'date' },
      { key: 'amount', label: 'Value', type: 'amount' },
    ],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (p) =>
        (!q || p.number.toLowerCase().includes(q) || p.vendor.name.toLowerCase().includes(q)) &&
        matchesFilters(p, defs, filters.values, pendingValue),
    );
  }, [items, search, defs, filters.values]);
  const { sorted: rows, sort, toggle } = useSort(filtered, PENDING_SORT);
  const narrowed = search.trim() !== '' || filters.activeCount > 0;

  return (
    <>
      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO or vendor…"
            aria-label="Search orders awaiting receipt"
          />
        }
        summary={shownSummary(isLoading, rows.length, truncated)}
      />
      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line text-muted border-b text-left">
            <tr>
              <SortableHead label="PO" sortKey="number" sort={sort} onSort={toggle} />
              <SortableHead label="Vendor" sortKey="vendor" sort={sort} onSort={toggle} />
              <th className="px-3 py-2.5 text-caption font-medium">Status</th>
              <SortableHead label="Expected" sortKey="expected" sort={sort} onSort={toggle} />
              <SortableHead label="Value" sortKey="amount" sort={sort} onSort={toggle} numeric />
              <th className="w-28 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={6}
              isLoading={isLoading}
              error={error}
              onRetry={onRetry}
              isEmpty={rows.length === 0}
              empty={
                narrowed
                  ? {
                      title: 'No orders match these filters',
                      detail: 'Clear a filter or change the search to see more.',
                      action: clearButton(() => {
                        filters.clear();
                        setSearch('');
                      }),
                    }
                  : {
                      title: 'Nothing awaiting receipt',
                      detail:
                        'Issued purchase orders with outstanding quantities will appear here.',
                    }
              }
            />
            {rows.map((po) => (
              <tr
                key={po.id}
                className="border-line duration-hover hover:bg-canvas/60 border-b transition-colors"
              >
                <td className="px-3 py-3.5">
                  <Link
                    href={`/purchase-orders/${po.id}`}
                    className="font-numeric text-ink hover:text-accent font-medium"
                  >
                    {po.number}
                  </Link>
                </td>
                <td className="px-3 py-3.5">
                  <EntityRef kind="vendor" id={po.vendor.id}>
                    {po.vendor.name}
                  </EntityRef>
                </td>
                <td className="px-3 py-3.5">
                  <Pill variant={statusVariant(po.status)} dot>
                    {statusLabel(po.status)}
                  </Pill>
                </td>
                <td className="font-numeric text-text px-3 py-3.5 text-caption">
                  {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '—'}
                </td>
                <td className="font-numeric text-ink px-3 py-3.5 text-right font-medium">
                  {inr(po.totalAmount)}
                </td>
                <td className="px-3 py-3.5 text-right">
                  <Link
                    href={`/goods-receipt/new?po=${po.id}`}
                    className="text-accent hover:text-accent-2 text-caption font-medium"
                  >
                    Receive →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Posted receipts ─────────────────────────────────────────────────────────

type GrnSortKey = 'number' | 'vendor' | 'received' | 'lines' | 'accepted' | 'value';
const GRN_SORT: Record<GrnSortKey, (g: GrnListItem) => string | number> = {
  number: (g) => g.number,
  vendor: (g) => g.vendor.name,
  received: (g) => g.receivedAt,
  lines: (g) => g.lineCount,
  accepted: (g) => g.acceptedPct,
  value: (g) => Number(g.totalValue),
};

// hasRejections is accepted by the API but ignored, so filters run client-side.
function grnValue(g: GrnListItem, key: string): string | number | null {
  switch (key) {
    case 'vendor':
      return g.vendor.id;
    case 'receiptType':
      return g.receiptType;
    case 'status':
      return g.status;
    case 'qcStatus':
      return g.qcStatus;
    case 'rejections':
      return g.hasRejections ? 'yes' : 'no';
    case 'received':
      return g.receivedAt;
    case 'value':
      return Number(g.totalValue);
    default:
      return null;
  }
}

function ReceiptsTable({
  tab,
  items,
  truncated,
  isLoading,
  error,
  onRetry,
}: ListProps<GrnListItem> & { tab: ReceiptTab }): React.JSX.Element {
  const [search, setSearch] = useState('');
  const filters = useFilters();

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'vendor',
        label: 'Vendor',
        type: 'select',
        options: optionsFrom(items, (g) => ({ value: g.vendor.id, label: g.vendor.name })),
      },
      {
        key: 'receiptType',
        label: 'Receipt type',
        type: 'select',
        options: optionsFrom(items, (g) => ({
          value: g.receiptType,
          label: humanise(g.receiptType),
        })),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: optionsFrom(items, (g) => ({ value: g.status, label: statusLabel(g.status) })),
      },
      {
        key: 'qcStatus',
        label: 'QC status',
        type: 'select',
        options: optionsFrom(items, (g) => ({
          value: g.qcStatus,
          label: statusLabel(g.qcStatus),
        })),
      },
      {
        key: 'rejections',
        label: 'Rejections',
        type: 'select',
        options: [
          { value: 'yes', label: 'Has rejections' },
          { value: 'no', label: 'No rejections' },
        ],
      },
      { key: 'received', label: 'Received', type: 'date' },
      { key: 'value', label: 'Value', type: 'amount' },
    ],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (g) =>
        (!q ||
          g.number.toLowerCase().includes(q) ||
          g.po.number.toLowerCase().includes(q) ||
          g.vendor.name.toLowerCase().includes(q)) &&
        matchesFilters(g, defs, filters.values, grnValue),
    );
  }, [items, search, defs, filters.values]);

  const { sorted: rows, sort, toggle } = useSort(filtered, GRN_SORT);
  const selection = useSelection(rows.map((r) => r.id));
  const selectedRows = rows.filter((r) => selection.isSelected(r.id));
  const narrowed = search.trim() !== '' || filters.activeCount > 0;

  const exportSelected = (): void =>
    downloadCsv(`goods-receipts-${tab}`, selectedRows, [
      { header: 'GRN', value: (g) => g.number },
      { header: 'PO', value: (g) => g.po.number },
      { header: 'Vendor', value: (g) => g.vendor.name },
      { header: 'MSME', value: (g) => (g.vendor.isMsme ? 'Yes' : 'No') },
      { header: 'Receipt type', value: (g) => humanise(g.receiptType) },
      { header: 'Status', value: (g) => statusLabel(g.status) },
      { header: 'QC status', value: (g) => statusLabel(g.qcStatus) },
      { header: 'Received', value: (g) => g.receivedAt.slice(0, 10) },
      { header: 'Lines', value: (g) => g.lineCount },
      { header: 'Accepted %', value: (g) => g.acceptedPct.toFixed(0) },
      { header: 'Has rejections', value: (g) => (g.hasRejections ? 'Yes' : 'No') },
      { header: 'Value', value: (g) => g.totalValue },
      { header: 'Currency', value: (g) => g.currency },
    ]);

  return (
    <>
      <FilterBar
        defs={defs}
        filters={filters}
        search={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search GRN, PO or vendor…"
            aria-label="Search goods receipts"
          />
        }
        summary={shownSummary(isLoading, rows.length, truncated)}
      />
      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line text-muted border-b text-left">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  aria-label="Select all shown receipts"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                  disabled={rows.length === 0}
                />
              </th>
              <SortableHead label="GRN" sortKey="number" sort={sort} onSort={toggle} />
              <th className="px-3 py-2.5 text-caption font-medium">PO</th>
              <SortableHead label="Vendor" sortKey="vendor" sort={sort} onSort={toggle} />
              <th className="px-3 py-2.5 text-caption font-medium">Type</th>
              <th className="px-3 py-2.5 text-caption font-medium">QC</th>
              <SortableHead label="Received" sortKey="received" sort={sort} onSort={toggle} />
              <SortableHead label="Lines" sortKey="lines" sort={sort} onSort={toggle} numeric />
              <SortableHead
                label="Accepted"
                sortKey="accepted"
                sort={sort}
                onSort={toggle}
                numeric
              />
              <SortableHead label="Value" sortKey="value" sort={sort} onSort={toggle} numeric />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={10}
              isLoading={isLoading}
              error={error}
              onRetry={onRetry}
              isEmpty={rows.length === 0}
              empty={
                narrowed
                  ? {
                      title: 'No receipts match these filters',
                      detail: 'Clear a filter or change the search to see more.',
                      action: clearButton(() => {
                        filters.clear();
                        setSearch('');
                      }),
                    }
                  : tab === 'all'
                    ? {
                        title: 'No goods receipts yet',
                        detail:
                          'Receipts are posted against issued purchase orders when material arrives at the gate.',
                        action: (
                          <Button asChild variant="secondary" size="sm">
                            <Link href="/goods-receipt/new">New receipt</Link>
                          </Button>
                        ),
                      }
                    : {
                        title: 'Nothing in this view',
                        detail: 'No receipts are in this state right now.',
                      }
              }
            />
            {rows.map((g) => {
              const isSel = selection.isSelected(g.id);
              return (
                <tr
                  key={g.id}
                  className={
                    'border-line duration-hover border-b transition-colors ' +
                    (isSel ? 'bg-accent-wash/60' : 'hover:bg-canvas/60')
                  }
                >
                  <td className="px-3 py-3.5">
                    <Checkbox
                      aria-label={`Select ${g.number}`}
                      checked={isSel}
                      onChange={() => selection.toggle(g.id)}
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <div>
                      <Link
                        href={`/goods-receipt/${g.id}`}
                        className="font-numeric text-ink hover:text-accent font-medium"
                      >
                        {g.number}
                      </Link>
                      <div className="mt-0.5">
                        <Pill variant={statusVariant(g.status)} dot>
                          {statusLabel(g.status)}
                        </Pill>
                      </div>
                    </div>
                  </td>
                  <td className="font-numeric px-3 py-3.5 text-caption">
                    <Link href={`/purchase-orders/${g.po.id}`} className="text-text hover:text-accent">
                      {g.po.number}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5">
                    <span>
                      <EntityRef kind="vendor" id={g.vendor.id}>
                        {g.vendor.name}
                      </EntityRef>
                      {g.vendor.isMsme && (
                        <Badge variant="classification" className="ml-1.5">
                          MSME
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="text-muted px-3 py-3.5 text-caption">{humanise(g.receiptType)}</td>
                  <td className="px-3 py-3.5">
                    <Pill variant={statusVariant(g.qcStatus)} dot>
                      {statusLabel(g.qcStatus)}
                    </Pill>
                  </td>
                  <td className="font-numeric text-text px-3 py-3.5 text-caption">
                    {formatDate(g.receivedAt)}
                  </td>
                  <td className="font-numeric text-text px-3 py-3.5 text-right">{g.lineCount}</td>
                  <td className="font-numeric px-3 py-3.5 text-right">
                    <span className="inline-flex flex-col items-end">
                      <span className="text-text">{g.acceptedPct.toFixed(0)}%</span>
                      {g.hasRejections && (
                        <span className="text-danger text-micro">rejections</span>
                      )}
                    </span>
                  </td>
                  <td className="font-numeric text-ink px-3 py-3.5 text-right font-medium">
                    {inr(g.totalValue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <BulkActionBar count={selection.count} noun="receipt" onClear={selection.clear}>
        <Button size="sm" variant="secondary" onClick={exportSelected}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      </BulkActionBar>
    </>
  );
}
