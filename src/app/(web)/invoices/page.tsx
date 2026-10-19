'use client';

import {
  Badge,
  BulkActionBar,
  Button,
  Checkbox,
  ExpandToggle,
  FilterBar,
  Input,
  NotShipped,
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
import { Download } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { PERMISSIONS, type InvoiceListItem, type InvoiceTab } from '@/lib/shared';

import { EntityRef } from '@/components/entity-ref';
import {
  BulkAssignDialog,
  BulkHoldDialog,
  summarise,
  type BulkResult,
} from '@/components/invoices/bulk-actions';
import { RowDetail } from '@/components/invoices/row-detail';
import { useInvoiceCounts, useInvoices } from '@/lib/api/invoices';
import { downloadCsv } from '@/lib/csv';
import { inr, msmeVariant, statusLabel, statusVariant } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { useInitialTab } from '@/lib/use-initial-tab';
import { useToastStore } from '@/store/toast-store';

const TABS: { key: InvoiceTab; label: string; countKey: keyof CountShape }[] = [
  { key: 'all', label: 'All open', countKey: 'all' },
  { key: 'exceptions', label: 'Exceptions', countKey: 'exceptions' },
  { key: 'approval', label: 'Approval', countKey: 'approval' },
  { key: 'approved', label: 'Approved', countKey: 'approved' },
  { key: 'scheduled', label: 'Scheduled', countKey: 'scheduled' },
  { key: 'paid', label: 'Paid', countKey: 'paid' },
  { key: 'msme', label: 'MSME risk', countKey: 'msme' },
  { key: 'proforma', label: 'Awaiting tax invoice', countKey: 'proforma' },
  { key: 'rejected', label: 'Rejected', countKey: 'rejected' },
  { key: 'everything', label: 'All invoices', countKey: 'everything' },
];
type CountShape = {
  everything: number;
  all: number;
  exceptions: number;
  approval: number;
  approved: number;
  scheduled: number;
  paid: number;
  msme: number;
  proforma: number;
  rejected: number;
};

type SortKey = 'number' | 'supplier' | 'status' | 'aging' | 'amount';
const SORT: Record<SortKey, (i: InvoiceListItem) => string | number> = {
  number: (i) => i.number,
  supplier: (i) => i.vendor.name,
  status: (i) => statusLabel(i.status),
  aging: (i) => i.agingDays,
  amount: (i) => Number(i.grossAmount),
};

// Cost centre, approver and invoice date are not in the list payload
// (InvoiceListItem), so they are not offered as filters rather than faked.
function filterValue(i: InvoiceListItem, key: string): string | number | null {
  switch (key) {
    case 'vendor':
      return i.vendor.id;
    case 'status':
      return i.status;
    case 'assignee':
      return i.assignedTo?.id ?? 'none';
    case 'msme':
      return i.vendor.isMsme ? 'yes' : 'no';
    case 'amount':
      return Number(i.grossAmount);
    case 'aging':
      return i.agingDays;
    default:
      return null;
  }
}

export default function InvoicesInboxPage(): React.JSX.Element {
  const [tab, setTab] = useState<InvoiceTab>('all');
  useInitialTab(TABS.map((t) => t.key), setTab);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'assign' | 'hold' | null>(null);
  const filters = useFilters();
  const { data: counts } = useInvoiceCounts();
  const { data, isLoading, error, refetch } = useInvoices(tab);
  const toast = useToastStore((s) => s.push);
  // Assign and hold are gated on INVOICE_OPERATE_SCOPES server-side.
  const canIntake = useHasPermission(PERMISSIONS.INVOICE_INTAKE_MANAGE);
  const canResolve = useHasPermission(PERMISSIONS.INVOICE_RESOLVE_EXCEPTION);
  const canOperate = canIntake || canResolve;

  const items = useMemo(() => data?.items ?? [], [data]);

  const defs = useMemo<FilterDef[]>(
    () => [
      {
        key: 'vendor',
        label: 'Supplier',
        type: 'select',
        options: optionsFrom(items, (i) => ({ value: i.vendor.id, label: i.vendor.name })),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: optionsFrom(items, (i) => ({ value: i.status, label: statusLabel(i.status) })),
      },
      {
        key: 'assignee',
        label: 'Assignee',
        type: 'select',
        options: [
          { value: 'none', label: 'Unassigned' },
          ...optionsFrom(items, (i) =>
            i.assignedTo ? { value: i.assignedTo.id, label: i.assignedTo.name } : null,
          ),
        ],
      },
      {
        key: 'msme',
        label: 'MSME supplier',
        type: 'select',
        options: [
          { value: 'yes', label: 'MSME only' },
          { value: 'no', label: 'Non-MSME only' },
        ],
      },
      { key: 'amount', label: 'Amount', type: 'amount' },
      { key: 'aging', label: 'Aging', type: 'number', unit: 'd' },
    ],
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!q ||
          i.number.toLowerCase().includes(q) ||
          i.vendor.name.toLowerCase().includes(q) ||
          (i.vendorInvoiceRef ?? '').toLowerCase().includes(q)) &&
        matchesFilters(i, defs, filters.values, filterValue),
    );
  }, [items, search, defs, filters.values]);

  const { sorted: rows, sort, toggle: toggleSort } = useSort(filtered, SORT);
  const selection = useSelection(rows.map((r) => r.id));
  const selectedRows = rows.filter((r) => selection.isSelected(r.id));
  const narrowed = search.trim() !== '' || filters.activeCount > 0;

  const onBulkDone = (verb: string) => (r: BulkResult) => {
    toast(summarise(verb, r), r.failed.length ? 'error' : 'success');
    if (r.failed.length === 0) selection.clear();
  };

  const exportSelected = (): void =>
    downloadCsv(`invoices-${tab}`, selectedRows, [
      { header: 'Invoice', value: (i) => i.number },
      { header: 'Supplier ref', value: (i) => i.vendorInvoiceRef },
      { header: 'Supplier', value: (i) => i.vendor.name },
      { header: 'MSME', value: (i) => (i.vendor.isMsme ? 'Yes' : 'No') },
      { header: 'PO', value: (i) => i.poNumber },
      { header: 'GRN', value: (i) => i.grnNumber },
      { header: 'Status', value: (i) => statusLabel(i.status) },
      { header: 'Exceptions', value: (i) => i.exceptionCount },
      { header: 'Aging (days)', value: (i) => i.agingDays },
      { header: 'Amount', value: (i) => i.grossAmount },
      { header: 'Currency', value: (i) => i.currency },
      { header: 'Assignee', value: (i) => i.assignedTo?.name },
    ]);

  return (
    <div className="pb-20">
      <PageHeader
        title="Invoices"
        description="Accounts payable inbox"
        actions={
          <>
            <NotShipped reason="Bulk invoice import is not available yet. Invoices arrive by email intake or vendor submission.">
              <Button variant="secondary" size="sm" disabled>
                Import
              </Button>
            </NotShipped>
            <NotShipped reason="Manual invoice entry is not available yet. Invoices arrive by email intake or vendor submission.">
              <Button variant="secondary" size="sm" disabled>
                New invoice
              </Button>
            </NotShipped>
          </>
        }
      />

      <SubNav
        className="mb-4"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count: counts?.[t.countKey] ?? 0,
        }))}
        value={tab}
        onChange={(k) => {
          setTab(k as (typeof TABS)[number]['key']);
          // Collapse any open row detail: the expanded invoice belongs to the
          // view you just left and would render against the wrong list.
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
            placeholder="Search invoice, supplier or reference…"
            aria-label="Search invoices"
          />
        }
        summary={
          isLoading ? null : (
            <>
              {`${rows.length} shown${data?.truncated ? ' — first 2,000 loaded' : ''}`}
              {/* Filters only narrow the tab you are on; a supplier's paid or
                  rejected bills live in other tabs. One click widens the
                  search to every invoice, keeping the filters. */}
              {narrowed && tab !== 'everything' && (
                <>
                  {' · '}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-caption"
                    onClick={() => {
                      setTab('everything');
                      setExpanded(null);
                    }}
                  >
                    Search all invoices
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left text-muted">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  aria-label="Select all shown invoices"
                  checked={selection.allSelected}
                  indeterminate={selection.someSelected}
                  onChange={selection.toggleAll}
                  disabled={rows.length === 0}
                />
              </th>
              <th className="w-8 px-1 py-2.5" />
              <SortableHead label="Invoice" sortKey="number" sort={sort} onSort={toggleSort} />
              <SortableHead label="Supplier" sortKey="supplier" sort={sort} onSort={toggleSort} />
              <th className="px-3 py-2.5 text-caption font-medium">PO / GRN</th>
              <SortableHead label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortableHead label="Aging" sortKey="aging" sort={sort} onSort={toggleSort} />
              <SortableHead
                label="Amount"
                sortKey="amount"
                sort={sort}
                onSort={toggleSort}
                numeric
              />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={8}
              isLoading={isLoading}
              error={error}
              isEmpty={rows.length === 0}
              onRetry={() => void refetch()}
              empty={
                narrowed
                  ? {
                      title: 'No invoices match these filters',
                      detail:
                        tab === 'everything'
                          ? 'Clear a filter or change the search to see more.'
                          : 'This tab only holds some invoices. Search every status, or clear a filter.',
                      action: (
                        <span className="inline-flex gap-2">
                          {tab !== 'everything' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setTab('everything');
                                setExpanded(null);
                              }}
                            >
                              Search all invoices
                            </Button>
                          )}
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
                        </span>
                      ),
                    }
                  : tab === 'all'
                    ? {
                        title: 'No open invoices',
                        detail:
                          'Invoices land here from email intake and vendor submissions. Set up an intake mailbox to start receiving them.',
                        action: (
                          <Button asChild variant="secondary" size="sm">
                            <Link href="/invoices/intake">Open email intake</Link>
                          </Button>
                        ),
                      }
                    : {
                        title: 'Nothing in this view',
                        detail: 'No invoices are in this state right now.',
                      }
              }
            />
            {rows.map((inv) => {
              const isOpen = expanded === inv.id;
              const isSel = selection.isSelected(inv.id);
              return (
                // Keyed on the fragment: each iteration renders a row pair
                // (summary + expanded detail).
                <Fragment key={inv.id}>
                  <tr
                    className={
                      'border-line border-b transition-colors duration-hover ' +
                      (isSel ? 'bg-accent-wash/60' : isOpen ? 'bg-canvas' : 'hover:bg-canvas/60')
                    }
                  >
                    <td className="px-3 py-3.5">
                      <Checkbox
                        aria-label={`Select ${inv.number}`}
                        checked={isSel}
                        onChange={() => selection.toggle(inv.id)}
                      />
                    </td>
                    <td className="px-1 py-3.5">
                      <ExpandToggle
                        open={isOpen}
                        label={inv.number}
                        onToggle={() => setExpanded(isOpen ? null : inv.id)}
                      />
                    </td>
                    <td className="px-3 py-3.5">
                      <div>
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-numeric text-ink hover:text-accent font-medium"
                        >
                          {inv.number}
                        </Link>
                        <div className="font-numeric text-faint text-micro">
                          {inv.vendorInvoiceRef}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span>
                        <EntityRef kind="vendor" id={inv.vendor.id}>
                          {inv.vendor.name}
                        </EntityRef>
                        {inv.vendor.isMsme && (
                          <Badge variant="classification" className="ml-1.5">
                            MSME
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="font-numeric text-muted px-3 py-3.5 text-caption">
                      {inv.poNumber ?? '—'}
                      {inv.grnNumber ? ` / ${inv.grnNumber}` : ''}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <Pill variant={statusVariant(inv.status)} dot>
                          {statusLabel(inv.status)}
                        </Pill>
                        {inv.documentKind === 'PROFORMA' && <Pill variant="warn">PI</Pill>}
                        {inv.exceptionCount > 0 && (
                          <span className="text-danger text-caption">
                            {inv.exceptionCount === 1
                              ? '1 exception'
                              : `${inv.exceptionCount} exceptions`}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-numeric text-text">{inv.agingDays}d</span>
                        {inv.msme && (
                          <Pill variant={msmeVariant(inv.msme.bucket)}>
                            {inv.msme.daysRemaining}d
                          </Pill>
                        )}
                      </span>
                    </td>
                    <td className="font-numeric text-ink px-3 py-3.5 text-right font-medium">
                      {inr(inv.grossAmount)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <RowDetail id={inv.id} />
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
        noun="invoice"
        onClear={selection.clear}
        note={
          // Approve/reject need each invoice's approval id, which the list
          // does not carry — the Approvals queue is where they happen in bulk.
          <Link href="/inbox" className="underline underline-offset-2 hover:text-white">
            Approve or reject in your Approvals inbox
          </Link>
        }
      >
        {canOperate && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setDialog('assign')}>
              Assign
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog('hold')}>
              Hold
            </Button>
          </>
        )}
        <Button size="sm" variant="secondary" onClick={exportSelected}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      </BulkActionBar>

      <BulkAssignDialog
        ids={selectedRows.map((r) => r.id)}
        open={dialog === 'assign'}
        onOpenChange={(o) => setDialog(o ? 'assign' : null)}
        onDone={onBulkDone('Assigned')}
      />
      <BulkHoldDialog
        ids={selectedRows.map((r) => r.id)}
        open={dialog === 'hold'}
        onOpenChange={(o) => setDialog(o ? 'hold' : null)}
        onDone={onBulkDone('Held')}
      />
    </div>
  );
}
