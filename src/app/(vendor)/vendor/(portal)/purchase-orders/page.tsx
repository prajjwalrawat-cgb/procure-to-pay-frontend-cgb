'use client';

import { Input, Pill } from '@/components/ui';
import { Money, type VendorPoListItem } from '@/lib/shared';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useVendorPos } from '@/vendor/lib/api/purchase-orders';

const label = (status: string): string => status.replace(/_/g, ' ');
const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-IN') : '—';
const inr = (v: string): string => Money.of(v || 0).toINR();

export default function VendorPurchaseOrdersPage(): React.JSX.Element {
  const router = useRouter();
  const { data, isLoading } = useVendorPos();
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = data?.items ?? [];
    if (!q) return items;
    return items.filter(
      (p) =>
        p.number.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          Purchase orders
        </h1>
        <p className="text-muted text-[13px]">
          Orders issued to you — acknowledge receipt and track fulfilment
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-faint pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO number or description…"
            className="h-8 w-72 pl-8"
          />
        </div>
        <span className="text-muted ml-auto text-[12px]">{rows.length} shown</span>
      </div>

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2.5 font-medium">PO</th>
                <th className="px-3 py-2.5 font-medium">Description</th>
                <th className="px-3 py-2.5 font-medium">Ordered</th>
                <th className="px-3 py-2.5 font-medium">Expected</th>
                <th className="px-3 py-2.5 font-medium">Fulfilment</th>
                <th className="px-3 py-2.5 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="text-muted px-3 py-10 text-center">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted px-3 py-10 text-center">
                    {(data?.items.length ?? 0) === 0
                      ? 'No purchase orders issued to you yet.'
                      : 'No purchase orders match your search.'}
                  </td>
                </tr>
              )}
              {rows.map((po: VendorPoListItem) => (
                <tr
                  key={po.id}
                  onClick={() => router.push(`/vendor/purchase-orders/${po.id}`)}
                  className="border-line hover:bg-canvas/60 cursor-pointer border-t"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-numeric text-ink font-medium">
                        {po.number}
                      </span>
                      {po.acknowledged && (
                        <Pill variant="success" dot>
                          Acknowledged
                        </Pill>
                      )}
                    </div>
                  </td>
                  <td className="text-text max-w-xs truncate px-3 py-2.5">
                    {po.description}
                  </td>
                  <td className="font-numeric text-text px-3 py-2.5">
                    {fmtDate(po.orderedDate)}
                  </td>
                  <td className="font-numeric text-text px-3 py-2.5">
                    {fmtDate(po.expectedDeliveryDate)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="bg-canvas border-line h-1.5 w-16 overflow-hidden rounded-full border">
                        <div
                          className="bg-accent h-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, po.fulfilmentPct))}%`,
                          }}
                        />
                      </div>
                      <span className="font-numeric text-muted text-[12px]">
                        {po.fulfilmentPct}%
                      </span>
                    </div>
                  </td>
                  <td className="font-numeric text-ink px-3 py-2.5 text-right">
                    {inr(po.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
