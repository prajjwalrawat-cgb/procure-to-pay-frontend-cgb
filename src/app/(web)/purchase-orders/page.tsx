'use client';

import { Button, PageHeader, Pill, TableState } from '@/components/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { usePurchaseOrders, type PoTab } from '@/lib/api/purchase-orders';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { tenantSuffix, useTenantName } from '@/store/session-store';

const TABS: { key: PoTab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'partial', label: 'Partial' },
  { key: 'awaiting_grn', label: 'Awaiting GRN' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function PurchaseOrdersPage(): React.JSX.Element {
  const tenantName = useTenantName();
  const [tab, setTab] = useState<PoTab>('open');
  const { data, isLoading, error, refetch } = usePurchaseOrders(tab);
  const counts = data?.counts;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Purchase orders"
        description={`Issued & in-flight orders${tenantSuffix(tenantName)}`}
        actions={
          // Spot buy — no requisition behind it; see /purchase-orders/new.
          <Link href="/purchase-orders/new">
            <Button variant="primary" size="sm">
              <Plus className="h-3.5 w-3.5" /> New PO
            </Button>
          </Link>
        }
      />

      <div className="border-line mb-3 flex items-center gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'duration-hover flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
              (tab === t.key
                ? 'border-accent text-ink'
                : 'text-muted hover:text-text border-transparent')
            }
          >
            {t.label}
            <span className="font-numeric text-faint text-[11px]">
              {counts?.[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 font-medium">PO</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Cost centre</th>
              <th className="px-3 py-2 font-medium">Fulfilment</th>
              <th className="px-3 py-2 font-medium">Expected</th>
              <th className="px-3 py-2 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={7}
              isLoading={isLoading}
              error={error}
              isEmpty={(data?.items.length ?? 0) === 0}
              onRetry={() => void refetch()}
              empty={{
                title: 'No purchase orders in this view',
                detail:
                  tab === 'open'
                    ? 'Approved requisitions converted to orders will appear here.'
                    : 'Orders reach this view as they move through their lifecycle.',
                action:
                  tab === 'open' ? (
                    <Link href="/purchase-orders/new">
                      <Button variant="primary" size="sm">
                        <Plus className="h-3.5 w-3.5" /> New PO
                      </Button>
                    </Link>
                  ) : undefined,
              }}
            />
            {data?.items.map((po) => (
              <tr key={po.id} className="border-line hover:bg-canvas/60 border-t">
                <td className="px-3 py-2">
                  <Link
                    href={`/purchase-orders/${po.id}`}
                    className="font-numeric text-ink font-medium"
                  >
                    {po.number}
                  </Link>
                  <div className="mt-0.5">
                    <Pill variant={statusVariant(po.status)} dot>
                      {statusLabel(po.status)}
                    </Pill>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="text-text">{po.vendor.name}</span>
                  {po.vendor.isMsme && (
                    <Pill variant="violet" className="ml-1.5">
                      MSME
                    </Pill>
                  )}
                </td>
                <td className="text-muted px-3 py-2 text-[12px]">{po.description}</td>
                <td className="text-muted px-3 py-2 text-[12px]">
                  {po.costCenter ? `${po.costCenter.code}` : '—'}
                </td>
                <td className="px-3 py-2">
                  <FulfilmentBar pct={po.fulfilmentPct} />
                </td>
                <td className="font-numeric text-text px-3 py-2 text-[12px]">
                  {po.expectedDeliveryDate
                    ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN')
                    : '—'}
                </td>
                <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                  {inr(po.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FulfilmentBar({ pct }: { pct: number }): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="bg-canvas h-1.5 w-24 overflow-hidden rounded-full">
        <div
          className={
            'h-full rounded-full ' +
            (clamped >= 100 ? 'bg-accent' : clamped > 0 ? 'bg-info' : 'bg-faint')
          }
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="font-numeric text-faint text-[11px]">{clamped.toFixed(0)}%</span>
    </div>
  );
}
