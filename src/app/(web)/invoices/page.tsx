'use client';

import {
  Button,
  Input,
  NotShipped,
  PageHeader,
  Pill,
  TableState,
} from '@/components/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import type { InvoiceTab } from '@/lib/shared';

import { EntityRef } from '@/components/entity-ref';
import { RowDetail } from '@/components/invoices/row-detail';
import { useInvoiceCounts, useInvoices } from '@/lib/api/invoices';
import { inr, msmeVariant, statusLabel, statusVariant } from '@/lib/format';
import { tenantSuffix, useTenantName } from '@/store/session-store';
import { useToastStore } from '@/store/toast-store';

const TABS: { key: InvoiceTab; label: string; countKey: keyof CountShape }[] = [
  { key: 'all', label: 'All open', countKey: 'all' },
  { key: 'exceptions', label: 'Exceptions', countKey: 'exceptions' },
  { key: 'approval', label: 'Approval', countKey: 'approval' },
  { key: 'scheduled', label: 'Scheduled', countKey: 'scheduled' },
  { key: 'paid', label: 'Paid', countKey: 'paid' },
  { key: 'msme', label: 'MSME risk', countKey: 'msme' },
];
type CountShape = {
  all: number;
  exceptions: number;
  approval: number;
  scheduled: number;
  paid: number;
  msme: number;
};

export default function InvoicesInboxPage(): React.JSX.Element {
  const tenantName = useTenantName();
  const [tab, setTab] = useState<InvoiceTab>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const { data: counts } = useInvoiceCounts();
  const { data, isLoading, error, refetch } = useInvoices(tab);
  const toast = useToastStore((s) => s.push);

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.number.toLowerCase().includes(q) || i.vendor.name.toLowerCase().includes(q),
    );
  }, [data, search]);

  const toggleSel = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Invoices"
        description={`Accounts payable inbox${tenantSuffix(tenantName)}`}
        actions={
          <>
            {/* Both of these were live-looking buttons whose only behaviour was
                a "coming soon" toast. Marked rather than removed so the roadmap
                stays visible without pretending the capability is here. */}
            <NotShipped reason="Bulk invoice import arrives in a later slice.">
              <Button variant="default" size="sm" disabled>
                Import
              </Button>
            </NotShipped>
            <NotShipped reason="Manual invoice entry arrives in a later slice. Invoices currently arrive by email intake or vendor submission.">
              <Button variant="default" size="sm" disabled>
                New invoice
              </Button>
            </NotShipped>
          </>
        }
      />

      <div className="border-line mb-3 flex items-center gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setExpanded(null);
            }}
            className={
              'duration-hover flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
              (tab === t.key
                ? 'border-accent text-ink'
                : 'text-muted hover:text-text border-transparent')
            }
          >
            {t.label}
            <span className="font-numeric text-faint text-[11px]">
              {counts?.[t.countKey] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice or supplier…"
          className="h-8 max-w-xs"
        />
        <span className="text-muted text-[12px]">{rows.length} shown</span>
      </div>

      {selected.size > 0 && (
        <div className="bg-accent-wash mb-3 flex items-center gap-2 rounded-sm px-3 py-2 text-[13px]">
          <span className="text-accent-2 font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            variant="default"
            onClick={() => toast('Assigned', 'success')}
          >
            Assign
          </Button>
          <Button size="sm" variant="default" onClick={() => toast('Held', 'success')}>
            Hold
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="w-8 px-1 py-2" />
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Supplier</th>
              <th className="px-3 py-2 font-medium">PO / GRN</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Aging</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={8}
              isLoading={isLoading}
              error={error}
              isEmpty={rows.length === 0}
              onRetry={() => void refetch()}
              empty={{
                title: search
                  ? 'No invoices match that search'
                  : 'No invoices in this view',
                detail: search
                  ? 'Try a different invoice number or supplier name.'
                  : 'Invoices arrive here from email intake, vendor submission, or import.',
              }}
            />
            {rows.map((inv) => {
              const isOpen = expanded === inv.id;
              return (
                // Keyed on the fragment, not the inner rows: each iteration
                // renders a row pair (summary + expanded detail), so the key
                // has to sit on the wrapper or React cannot reconcile them.
                <Fragment key={inv.id}>
                  <tr
                    className={
                      'border-line border-t ' +
                      (isOpen ? 'bg-canvas' : 'hover:bg-canvas/60')
                    }
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${inv.number}`}
                        checked={selected.has(inv.id)}
                        onChange={() => toggleSel(inv.id)}
                      />
                    </td>
                    <td className="px-1 py-2">
                      <button
                        type="button"
                        aria-label={`Expand ${inv.number}`}
                        onClick={() => setExpanded(isOpen ? null : inv.id)}
                        className="text-muted hover:bg-line rounded-sm p-1"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-numeric text-ink font-medium"
                      >
                        {inv.number}
                      </Link>
                      <div className="font-numeric text-faint text-[11px]">
                        {inv.vendorInvoiceRef}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <EntityRef kind="vendor" id={inv.vendor.id}>
                        {inv.vendor.name}
                      </EntityRef>
                      {inv.vendor.isMsme && (
                        <Pill variant="violet" className="ml-1.5">
                          MSME
                        </Pill>
                      )}
                    </td>
                    <td className="font-numeric text-muted px-3 py-2 text-[12px]">
                      {inv.poNumber ?? '—'}
                      {inv.grnNumber ? ` · ${inv.grnNumber}` : ''}
                    </td>
                    <td className="px-3 py-2">
                      <Pill variant={statusVariant(inv.status)} dot>
                        {statusLabel(inv.status)}
                      </Pill>
                      {inv.exceptionCount > 0 && (
                        <span className="font-numeric text-danger ml-1.5 text-[11px]">
                          {inv.exceptionCount} exc
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-numeric text-text">{inv.agingDays}d</span>
                      {inv.msme && (
                        <Pill variant={msmeVariant(inv.msme.bucket)} className="ml-1.5">
                          {inv.msme.daysRemaining}d
                        </Pill>
                      )}
                    </td>
                    <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
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
    </div>
  );
}
