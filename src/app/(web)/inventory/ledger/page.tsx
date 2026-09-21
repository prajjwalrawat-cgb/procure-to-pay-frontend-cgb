'use client';

import {
  Badge,
  Button,
  PageHeader,
  Pill,
  SubNav,
  cn,
  controlClass,
} from '@/components/ui';
import { LEDGER_SAVED_VIEWS, type LedgerEntryView } from '@/lib/shared';
import Link from 'next/link';
import { useState } from 'react';

import { useLedger, useLocations } from '@/lib/api/inventory';
import { txnLabel, txnVariant } from '../_components/txn-display';
import { formatDate } from '@/lib/format';

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
    <div>
      <PageHeader
        title="Stock ledger"
        description={
          <>
            {data?.totalEstimate ?? 0} movements, insert-only, corrections are offsetting
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

      <SubNav
        className="mb-3"
        aria-label="Saved ledger views"
        items={[
          { key: 'all', label: 'All movements' },
          ...LEDGER_SAVED_VIEWS.map((v) => ({ key: v.key, label: v.label })),
        ]}
        value={view}
        onChange={(k) => setView(k as typeof view)}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className={cn(controlClass, 'w-auto')}
        >
          <option value="">All locations</option>
          {(locations.data?.items ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.rackNo ? `, ${l.rackNo}` : ''}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-body-sm text-muted">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-line bg-panel px-2 py-1 text-body-sm text-text outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-body-sm text-muted">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-line bg-panel px-2 py-1 text-body-sm text-text outline-none"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-body-sm">
          <thead className="border-line border-b text-left text-caption text-muted">
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
      <td className="font-numeric px-3 py-2 text-caption text-muted">
        {formatDate(e.txnDate)}
      </td>
      <td className="px-3 py-2">
        <div className="text-ink">{e.productName}</div>
        <div className="font-numeric text-micro text-faint">
          {e.productCode}
          {e.colour ? `, ${e.colour}` : ''}
        </div>
      </td>
      <td className="px-3 py-2">
        <Pill variant={txnVariant(e.txnType)}>{txnLabel(e.txnType)}</Pill>
        {e.correctionOfId && (
          <Badge variant="classification" className="ml-1.5">
            Correction
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-caption text-muted">{e.locationName}</td>
      <td className="px-3 py-2 text-caption text-text">
        {e.vendorName ??
          e.issuedToName ??
          e.customerName ??
          (e.purchaseOrderNumber ? `PO ${e.purchaseOrderNumber}` : null) ??
          '—'}
        {e.orderId && (
          <span className="font-numeric ml-1 text-micro text-faint">#{e.orderId}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <span
          className={
            'font-numeric font-medium ' +
            (e.direction === 1 ? 'text-success' : 'text-danger')
          }
        >
          {e.direction === 1 ? '+' : '−'}
          {e.qty.toLocaleString('en-IN')}
        </span>
      </td>
      <td className="px-3 py-2">
        {e.issueStatus && (
          <Pill variant={e.issueStatus === 'OPEN' ? 'warn' : 'success'} dot>
            {e.issueStatus === 'OPEN' ? `Open, ${e.balanceQty}` : 'Closed'}
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
          className="text-caption font-medium text-accent-2 hover:underline"
          title="Post an offsetting adjustment for this entry"
        >
          Correct
        </Link>
      </td>
    </tr>
  );
}

