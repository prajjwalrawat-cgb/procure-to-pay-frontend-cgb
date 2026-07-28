'use client';

import { Button, Pill } from '@/components/ui';
import { LEDGER_SAVED_VIEWS, type LedgerEntryView } from '@/lib/shared';
import Link from 'next/link';
import { useState } from 'react';

import { useLedger, useLocations } from '@/lib/api/inventory';

type ViewKey = (typeof LEDGER_SAVED_VIEWS)[number]['key'] | 'all';

/**
 * Ledger / reports. One filterable view over the immutable ledger, with each of
 * the nine legacy sheets reproduced as a saved filter so the warehouse can keep
 * working the way it always has during rollout.
 */
export default function LedgerPage(): React.JSX.Element {
  const [view, setView] = useState<ViewKey>('all');
  const [locationId, setLocationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const saved = LEDGER_SAVED_VIEWS.find((v) => v.key === view);
  const locations = useLocations();
  const { data, isLoading } = useLedger({
    txnType: (saved?.txnType as never) ?? undefined,
    issueDept: ((saved as { issueDept?: string } | undefined)?.issueDept as never) ?? undefined,
    location: locationId || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    limit: 100,
  });

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Stock ledger
          </h1>
          <p className="text-muted text-[13px]">
            {data?.totalEstimate ?? 0} movements · insert-only, corrections are
            offsetting entries
          </p>
        </div>
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            Stock overview
          </Button>
        </Link>
      </div>

      <div className="border-line mb-3 flex flex-wrap items-center gap-1 border-b pb-1">
        <FilterTab active={view === 'all'} onClick={() => setView('all')}>
          All movements
        </FilterTab>
        {LEDGER_SAVED_VIEWS.map((v) => (
          <FilterTab key={v.key} active={view === v.key} onClick={() => setView(v.key)}>
            {v.label}
          </FilterTab>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="border-line bg-panel text-text rounded-md border px-3 py-1.5 text-[13px] outline-none"
        >
          <option value="">All locations</option>
          {(locations.data?.items ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.rackNo ? ` · ${l.rackNo}` : ''}
            </option>
          ))}
        </select>
        <label className="text-muted flex items-center gap-1.5 text-[13px]">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border-line bg-panel text-text rounded-md border px-2 py-1 text-[13px] outline-none"
          />
        </label>
        <label className="text-muted flex items-center gap-1.5 text-[13px]">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border-line bg-panel text-text rounded-md border px-2 py-1 text-[13px] outline-none"
          />
        </label>
      </div>

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Movement</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Counterparty</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-muted px-3 py-8 text-center">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted px-3 py-8 text-center">
                  No movements in this view.
                </td>
              </tr>
            )}
            {items.map((e) => (
              <LedgerRow key={e.id} entry={e} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LedgerRow({ entry: e }: { entry: LedgerEntryView }): React.JSX.Element {
  return (
    <tr className="border-line hover:bg-canvas/60 border-t">
      <td className="font-numeric text-muted px-3 py-2 text-[12px]">
        {new Date(e.txnDate).toLocaleDateString('en-IN')}
      </td>
      <td className="px-3 py-2">
        <div className="text-ink">{e.productName}</div>
        <div className="font-numeric text-faint text-[11px]">
          {e.productCode}
          {e.colour ? ` · ${e.colour}` : ''}
        </div>
      </td>
      <td className="px-3 py-2">
        <Pill variant={txnVariant(e.txnType)}>{txnLabel(e.txnType)}</Pill>
        {e.correctionOfId && (
          <Pill variant="violet" className="ml-1.5">
            Correction
          </Pill>
        )}
      </td>
      <td className="text-muted px-3 py-2 text-[12px]">{e.locationName}</td>
      <td className="text-text px-3 py-2 text-[12px]">
        {e.vendorName ??
          e.issuedToName ??
          e.customerName ??
          (e.purchaseOrderNumber ? `PO ${e.purchaseOrderNumber}` : null) ??
          '—'}
        {e.orderId && (
          <span className="font-numeric text-faint ml-1 text-[11px]">#{e.orderId}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <span
          className={
            'font-numeric font-medium ' +
            (e.direction === 1 ? 'text-emerald-700' : 'text-red-600')
          }
        >
          {e.direction === 1 ? '+' : '−'}
          {e.qty.toLocaleString('en-IN')}
        </span>
      </td>
      <td className="px-3 py-2">
        {e.issueStatus && (
          <Pill variant={e.issueStatus === 'OPEN' ? 'warn' : 'success'} dot>
            {e.issueStatus === 'OPEN' ? `Open · ${e.balanceQty}` : 'Closed'}
          </Pill>
        )}
        {e.qcStatus && (
          <Pill
            variant={
              e.qcStatus === 'OK' ? 'success' : e.qcStatus === 'REJECTED' ? 'danger' : 'warn'
            }
          >
            QC {e.qcStatus === 'PENDING' ? 'pending' : e.qcStatus.toLowerCase()}
          </Pill>
        )}
        {e.txnType === 'CUSTOMER_RETURN_IN' && e.restockDecision === null && (
          <Pill variant="warn" dot>
            Restock pending
          </Pill>
        )}
      </td>
    </tr>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-t border-b-2 px-3 py-1.5 text-[13px] font-medium transition-colors ' +
        (active ? 'border-accent text-ink' : 'text-muted hover:text-ink border-transparent')
      }
    >
      {children}
    </button>
  );
}

const TXN_LABELS: Record<string, string> = {
  VENDOR_INWARD: 'Vendor inward',
  VENDOR_RETURN_OUT: 'Vendor return',
  SAMPLE_INWARD: 'Sample inward',
  INTERNAL_ISSUE: 'Internal issue',
  INTERNAL_RETURN: 'Internal return',
  CUSTOMER_ORDER_OUT: 'Order out',
  CUSTOMER_RETURN_IN: 'Customer return',
  DAMAGE_WRITE_OFF: 'Damage write-off',
  ADJUSTMENT: 'Adjustment',
};

function txnLabel(t: string): string {
  return TXN_LABELS[t] ?? t;
}

function txnVariant(t: string): 'success' | 'danger' | 'warn' | 'info' | 'violet' | 'gray' {
  switch (t) {
    case 'VENDOR_INWARD':
    case 'SAMPLE_INWARD':
    case 'INTERNAL_RETURN':
      return 'success';
    case 'CUSTOMER_ORDER_OUT':
    case 'INTERNAL_ISSUE':
      return 'info';
    case 'DAMAGE_WRITE_OFF':
    case 'VENDOR_RETURN_OUT':
      return 'danger';
    case 'CUSTOMER_RETURN_IN':
      return 'warn';
    default:
      return 'gray';
  }
}
