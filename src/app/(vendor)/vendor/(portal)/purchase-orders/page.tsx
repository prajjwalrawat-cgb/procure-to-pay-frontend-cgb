'use client';

import { Input, PageHeader, Pill } from '@/components/ui';
import { Money, type VendorPoListItem } from '@/lib/shared';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useVendorPos } from '@/vendor/lib/api/purchase-orders';
import { formatDate } from '@/lib/format';

const label = (status: string): string => status.replace(/_/g, ' ');
const fmtDate = (iso: string | null): string =>
  iso ? formatDate(iso) : '—';
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
    <div>
      <div className="mb-4">
        <PageHeader
          title="Purchase orders"
          description="Orders issued to you — acknowledge receipt and track fulfilment"
        />
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO number or description…"
            className="h-8 w-72 pl-8"
          />
        </div>
        <span className="ml-auto text-[12px] text-muted">{rows.length} shown</span>
      </div>

      <div className="overflow-x-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-line border-b text-left text-[12px] text-muted">
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
                  <td colSpan={6} className="px-3 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted">
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
                  className="cursor-pointer border-t border-line hover:bg-canvas/60"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-numeric font-medium text-ink">
                        {po.number}
                      </span>
                      {po.acknowledged && (
                        <Pill variant="success" dot>
                          Acknowledged
                        </Pill>
                      )}
                    </div>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2.5 text-text">
                    {po.description}
                  </td>
                  <td className="font-numeric px-3 py-2.5 text-text">
                    {fmtDate(po.orderedDate)}
                  </td>
                  <td className="font-numeric px-3 py-2.5 text-text">
                    {fmtDate(po.expectedDeliveryDate)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full border border-line bg-canvas">
                        <div className="h-full bg-accent"
                          style={{
                            width: `${Math.min(100, Math.max(0, po.fulfilmentPct))}%`,
                          }}
                        />
                      </div>
                      <span className="font-numeric text-[12px] text-muted">
                        {po.fulfilmentPct}%
                      </span>
                    </div>
                  </td>
                  <td className="font-numeric px-3 py-2.5 text-right text-ink">
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
