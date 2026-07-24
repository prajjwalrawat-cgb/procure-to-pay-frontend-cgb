'use client';

import { Pill } from '@/components/ui';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { usePurchaseOrders, type PoTab } from '@/lib/api/purchase-orders';
import { inr, statusLabel, statusVariant } from '@/lib/format';

const TABS: { key: PoTab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'partial', label: 'Partial' },
  { key: 'awaiting_grn', label: 'Awaiting GRN' },
  { key: 'closed', label: 'Closed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function PurchaseOrdersPage(): React.JSX.Element {
  const [tab, setTab] = useState<PoTab>('open');
  const { data, isLoading } = usePurchaseOrders(tab);
  const counts = data?.counts;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Purchase orders
          </h1>
          <p className="text-muted text-[13px]">
            Issued & in-flight orders · Star Cement Ltd
          </p>
        </div>
      </div>

      <div className="border-line mb-3 flex items-center gap-1 border-b">
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

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
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
              <th className="w-8 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="text-muted px-3 py-8 text-center">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (data?.items.length ?? 0) === 0 && (
              <tr>
                <td colSpan={8} className="text-muted px-3 py-8 text-center">
                  No purchase orders in this view.
                </td>
              </tr>
            )}
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
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    aria-label="More"
                    className="text-muted hover:bg-line rounded-sm p-1"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
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
