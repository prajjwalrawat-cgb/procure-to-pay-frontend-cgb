'use client';

import { Button, PageHeader, Pill } from '@/components/ui';
import { LEDGER_SAVED_VIEWS, type LedgerEntryView } from '@/lib/shared';
import Link from 'next/link';
import { useState } from 'react';

import { useLedger, useLocations } from '@/lib/api/inventory';
import { txnLabel, txnVariant } from '../_components/txn-display';

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
    issueDept:
      ((saved as { issueDept?: string } | undefined)?.issueDept as never) ?? undefined,
    location: locationId || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    limit: 100,
  });

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Stock ledger"
        description={
          <>
            {data?.totalEstimate ?? 0} movements · insert-only, corrections are offsetting
            entries
          </>
        }
        actions={
          <>
            <Link href="/inventory">
              <Button variant="ghost" size="sm">
                Stock overview
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-line pb-1">
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
          className="rounded-md border border-line bg-panel px-3 py-1.5 text-[13px] text-text outline-none"
        >
          <option value="">All locations</option>
          {(locations.data?.items ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.rackNo ? ` · ${l.rackNo}` : ''}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-muted">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-line bg-panel px-2 py-1 text-[13px] text-text outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[13px] text-muted">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-line bg-panel px-2 py-1 text-[13px] text-text outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead className="bg-canvas text-left text-[11px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Movement</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Counterparty</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-20 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted">
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
    <tr className="border-t border-line hover:bg-canvas/60">
      <td className="font-numeric px-3 py-2 text-[12px] text-muted">
        {new Date(e.txnDate).toLocaleDateString('en-IN')}
      </td>
      <td className="px-3 py-2">
        <div className="text-ink">{e.productName}</div>
        <div className="font-numeric text-[11px] text-faint">
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
      <td className="px-3 py-2 text-[12px] text-muted">{e.locationName}</td>
      <td className="px-3 py-2 text-[12px] text-text">
        {e.vendorName ??
          e.issuedToName ??
          e.customerName ??
          (e.purchaseOrderNumber ? `PO ${e.purchaseOrderNumber}` : null) ??
          '—'}
        {e.orderId && (
          <span className="font-numeric ml-1 text-[11px] text-faint">#{e.orderId}</span>
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
              e.qcStatus === 'OK'
                ? 'success'
                : e.qcStatus === 'REJECTED'
                  ? 'danger'
                  : 'warn'
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
      <td className="px-3 py-2 text-right">
        {/* The entry itself can never be edited — this opens a compensating entry. */}
        <Link
          href={`/inventory/adjustments?correct=${e.id}`}
          className="text-[12px] font-medium text-accent-2 hover:underline"
          title="Post an offsetting adjustment for this entry"
        >
          Correct
        </Link>
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
        (active
          ? 'border-accent text-ink'
          : 'border-transparent text-muted hover:text-ink')
      }
    >
      {children}
    </button>
  );
}
