'use client';

import {
  Badge,
  Button,
  Input,
  PageHeader,
  SortableHead,
  TableState,
  useSort,
} from '@/components/ui';
import { Money, type VendorPoListItem } from '@/lib/shared';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useVendorPos } from '@/vendor/lib/api/purchase-orders';
import { formatDate } from '@/lib/format';

const fmtDate = (iso: string | null): string => (iso ? formatDate(iso) : '—');
const inr = (v: string): string => Money.of(v || 0).toINR();

type SortKey = 'number' | 'ordered' | 'expected' | 'fulfilment' | 'value';

export default function VendorPurchaseOrdersPage(): React.JSX.Element {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useVendorPos();
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
  const { sorted, sort, toggle } = useSort<VendorPoListItem, SortKey>(rows, {
    number: (p) => p.number,
    ordered: (p) => (p.orderedDate ? new Date(p.orderedDate) : null),
    expected: (p) => (p.expectedDeliveryDate ? new Date(p.expectedDeliveryDate) : null),
    fulfilment: (p) => p.fulfilmentPct,
    value: (p) => Number(p.totalAmount),
  });
  const firstRun = (data?.items.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        description="Orders issued to you. Acknowledge receipt and track fulfilment."
      />

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search
            className="text-faint pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO number or description…"
            aria-label="Search purchase orders"
            className="w-full pl-8"
          />
        </div>
        {!isLoading && !error && (
          <span className="text-muted ml-auto text-caption">{rows.length} shown</span>
        )}
      </div>

      <div className="border-line bg-panel overflow-hidden rounded-lg border">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-line border-b text-left">
            <tr>
              <SortableHead label="PO" sortKey="number" sort={sort} onSort={toggle} />
              <th className="text-muted px-3 py-2.5 text-caption font-medium">Description</th>
              <SortableHead label="Ordered" sortKey="ordered" sort={sort} onSort={toggle} />
              <SortableHead label="Expected" sortKey="expected" sort={sort} onSort={toggle} />
              <SortableHead
                label="Fulfilment"
                sortKey="fulfilment"
                sort={sort}
                onSort={toggle}
              />
              <SortableHead label="Value" sortKey="value" sort={sort} onSort={toggle} numeric />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={6}
              isLoading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              isEmpty={rows.length === 0}
              empty={
                firstRun
                  ? {
                      title: 'No purchase orders yet',
                      detail: 'Orders the buyer issues to you appear here for acknowledgement.',
                    }
                  : {
                      title: 'No purchase orders match your search',
                      action: (
                        <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                          Clear search
                        </Button>
                      ),
                    }
              }
            />
            {!isLoading &&
              sorted.map((po) => (
                <tr
                  key={po.id}
                  onClick={() => router.push(`/vendor/purchase-orders/${po.id}`)}
                  className="border-line hover:bg-canvas cursor-pointer border-b last:border-0"
                >
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* The row is clickable for the mouse; the number is the
                          real link, so the list works from the keyboard too. */}
                      <Link
                        href={`/vendor/purchase-orders/${po.id}`}
                        className="font-numeric text-ink hover:text-accent font-medium"
                      >
                        {po.number}
                      </Link>
                      {po.acknowledged && <Badge variant="positive">Acknowledged</Badge>}
                    </div>
                  </td>
                  <td className="text-text max-w-xs truncate px-3 py-3">{po.description}</td>
                  <td className="font-numeric text-text px-3 py-3">
                    {fmtDate(po.orderedDate)}
                  </td>
                  <td className="font-numeric text-text px-3 py-3">
                    {fmtDate(po.expectedDeliveryDate)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-canvas h-1.5 w-16 overflow-hidden rounded-full">
                        <div
                          className="bg-accent h-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, po.fulfilmentPct))}%`,
                          }}
                        />
                      </div>
                      <span className="font-numeric text-muted text-caption">
                        {po.fulfilmentPct}%
                      </span>
                    </div>
                  </td>
                  <td className="font-numeric text-ink px-3 py-3 text-right">
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
