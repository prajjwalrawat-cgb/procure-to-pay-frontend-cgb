'use client';

import {
  Badge,
  Button,
  PageHeader,
  Pill,
  SortableHead,
  SubNav,
  TableState,
  cn,
  controlClass,
  useSort,
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
  const { data, isLoading, error, refetch } = useLedger({
    txnType: (saved?.txnType as never) ?? undefined,
    issueDept:
      ((saved as { issueDept?: string } | undefined)?.issueDept as never) ?? undefined,
    location: locationId || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    limit: 100,
  });

  const items = data?.items ?? [];
  const { sorted, sort, toggle } = useSort(items, {
    date: (e) => e.txnDate,
    product: (e) => e.productName,
    location: (e) => e.locationName,
    qty: (e) => e.direction * e.qty,
  });

  return (
    <div>
      <PageHeader
        title="Stock ledger"
        description={
          <>
            {data ? `${data.totalEstimate} movements. ` : ''}Insert-only: corrections are
            offsetting entries, never edits.
          </>
        }
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/inventory">Stock overview</Link>
          </Button>
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
          aria-label="Location"
          className={cn(controlClass, 'w-auto min-w-0 max-w-full pr-8')}
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
            className={cn(controlClass, 'w-auto')}
          />
        </label>
        <label className="flex items-center gap-1.5 text-body-sm text-muted">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={cn(controlClass, 'w-auto')}
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-b border-line text-left text-caption text-muted">
            <tr>
              <SortableHead label="Date" sortKey="date" sort={sort} onSort={toggle} />
              <SortableHead
                label="Product"
                sortKey="product"
                sort={sort}
                onSort={toggle}
              />
              <th className="px-3 py-2.5 font-medium">Movement</th>
              <SortableHead
                label="Location"
                sortKey="location"
                sort={sort}
                onSort={toggle}
              />
              <th className="px-3 py-2.5 font-medium">Counterparty</th>
              <SortableHead
                label="Qty"
                sortKey="qty"
                sort={sort}
                onSort={toggle}
                numeric
              />
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="w-20 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={8}
              isLoading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              isEmpty={items.length === 0}
              empty={
                locationId || from || to || view !== 'all'
                  ? {
                      title: 'No movements in this view',
                      detail: 'Try another saved view, location or date range.',
                    }
                  : {
                      title: 'No stock movements yet',
                      detail:
                        'Receipts, issues, returns and adjustments are listed here as they post.',
                    }
              }
            />
            {sorted.map((e) => (
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
      <td className="font-numeric px-3 py-3.5 text-caption text-muted">
        {formatDate(e.txnDate)}
      </td>
      <td className="px-3 py-3.5">
        <div className="text-ink">{e.productName}</div>
        <div className="font-numeric text-micro text-faint">
          {e.productCode}
          {e.colour ? `, ${e.colour}` : ''}
        </div>
      </td>
      <td className="px-3 py-3.5">
        <Pill variant={txnVariant(e.txnType)}>{txnLabel(e.txnType)}</Pill>
        {e.correctionOfId && (
          <Badge variant="classification" className="ml-1.5">
            Correction
          </Badge>
        )}
      </td>
      <td className="px-3 py-3.5 text-caption text-muted">{e.locationName}</td>
      <td className="px-3 py-3.5 text-caption text-text">
        {e.vendorName ??
          e.issuedToName ??
          e.customerName ??
          (e.purchaseOrderNumber ? `PO ${e.purchaseOrderNumber}` : null) ??
          '—'}
        {e.orderId && (
          <span className="font-numeric ml-1 text-micro text-faint">#{e.orderId}</span>
        )}
      </td>
      <td className="px-3 py-3.5 text-right">
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
      <td className="px-3 py-3.5">
        <div className="flex flex-wrap justify-end gap-x-2 gap-y-1 md:justify-start">
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
        </div>
      </td>
      <td className="px-3 py-3.5 text-right">
        {/* The entry itself can never be edited — this opens a compensating entry. */}
        <Link
          href={`/inventory/adjustments?correct=${e.id}`}
          className="text-caption font-medium text-accent hover:underline"
          title="Post an offsetting adjustment for this entry"
        >
          Correct
        </Link>
      </td>
    </tr>
  );
}
