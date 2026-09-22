'use client';

import {
  Button,
  PageHeader,
  SortableHead,
  TableState,
  cn,
  controlClass,
  useSort,
} from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useLocations, useProducts } from '@/lib/api/inventory';
import { qty } from '@/lib/format';
import { ProductDrawer } from './_components/product-drawer';
import { ProductThumb } from './_components/product-thumb';

/**
 * Stock overview — the module's landing screen. Product list with per-location
 * breakdown and a low-stock flag against `reorderPoint`; clicking a row opens
 * the detail drawer that accounts for every legacy sheet column.
 */
export default function InventoryPage(): React.JSX.Element {
  const [q, setQ] = useState('');
  const [locationId, setLocationId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const locations = useLocations();
  const { data, isLoading, error, refetch } = useProducts({
    q: q || undefined,
    locationId: locationId || undefined,
    lowStock: lowStock || undefined,
    limit: 100,
  });

  const items = data?.items ?? [];
  const lowCount = items.filter((i) => i.lowStock).length;
  const { sorted, sort, toggle } = useSort(items, {
    product: (p) => p.name,
    category: (p) => p.category,
    reorder: (p) => (p.reorderPoint == null ? null : Number(p.reorderPoint)),
    stock: (p) => Number(p.currentStock),
  });

  return (
    <div>
      <PageHeader
        title="Stock overview"
        description={
          isLoading
            ? undefined
            : lowCount > 0
              ? `${data?.totalEstimate ?? 0} products, ${lowCount} at or below reorder point.`
              : `${data?.totalEstimate ?? 0} products.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* The floor's entry point. Discoverable from the desk so a supervisor
              can find it and point a stores officer at it; the scanner itself is
              built for a handset. */}
            <Button asChild variant="ghost" size="sm">
              <Link href="/scan" title="Barcode scanner — designed for a phone">
                Scanner
              </Link>
            </Button>
            {/* For products with no manufacturer EAN — prints their own code. */}
            <Button asChild variant="ghost" size="sm">
              <Link href="/labels?type=product" target="_blank">
                Print labels
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/inventory/bulk-upload">Bulk upload</Link>
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href="/inventory/products/new">New product</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, code, colour or legacy SKU…"
          aria-label="Search products"
          className={cn(
            controlClass,
            'w-full sm:w-auto sm:min-w-[16rem] sm:max-w-md sm:flex-1',
          )}
        />
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
          <input
            type="checkbox"
            className="accent-[var(--accent)]"
            checked={lowStock}
            onChange={(e) => setLowStock(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-b border-line text-left text-caption text-muted">
            <tr>
              <th className="w-14 whitespace-nowrap px-3 py-2.5 text-right font-medium">
                S. No.
              </th>
              <SortableHead
                label="Product"
                sortKey="product"
                sort={sort}
                onSort={toggle}
              />
              <SortableHead
                label="Category"
                sortKey="category"
                sort={sort}
                onSort={toggle}
              />
              <th className="px-3 py-2.5 font-medium">Locations</th>
              <SortableHead
                label="Reorder"
                sortKey="reorder"
                sort={sort}
                onSort={toggle}
                numeric
              />
              <SortableHead
                label="Current stock"
                sortKey="stock"
                sort={sort}
                onSort={toggle}
                numeric
              />
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={6}
              isLoading={isLoading}
              error={error}
              onRetry={() => void refetch()}
              isEmpty={items.length === 0}
              empty={
                q || locationId || lowStock
                  ? {
                      title: 'No products match this view',
                      detail: 'Clear the search or filters to see every product.',
                    }
                  : {
                      title: 'No products yet',
                      detail: (
                        <>
                          Start by adding a{' '}
                          <Link
                            href="/inventory/locations"
                            className="text-accent underline"
                          >
                            location
                          </Link>
                          , then create a product or bulk upload a sheet.
                        </>
                      ),
                      action: (
                        <Button asChild variant="primary" size="sm">
                          <Link href="/inventory/products/new">New product</Link>
                        </Button>
                      ),
                    }
              }
            />
            {sorted.map((p, i) => (
              <tr
                key={p.id}
                onClick={() => setSelected(p.id)}
                className="cursor-pointer border-t border-line hover:bg-canvas/60"
              >
                {/* Position in the current view, so it renumbers with filters
                    and sorting. Dropped from the stacked mobile card, where it
                    only pushes the product off the top line. */}
                <td className="font-numeric px-3 py-3.5 text-right text-caption text-faint max-md:!hidden">
                  {i + 1}
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <ProductThumb url={p.imageUrl} alt={p.name} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{p.name}</div>
                      <div className="font-numeric text-micro text-faint">
                        {p.code}
                        {p.colour ? ` — ${p.colour}` : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 text-caption text-muted">
                  {/* A category is a permanent fact about the product, so it
                      reads as plain text. It was a coloured status dot, which
                      put ten pieces of state colour in a column where nothing
                      ever changes state. */}
                  {p.category === 'Uncategorized' ? (
                    <span className="text-faint">Uncategorised</span>
                  ) : (
                    p.category
                  )}
                </td>
                <td className="px-3 py-3.5 text-caption text-muted">
                  {p.locations.length === 0
                    ? '—'
                    : p.locations
                        .map(
                          (l) =>
                            `${l.locationName}${l.rackNo ? ` (${l.rackNo})` : ''} ${l.qty}`,
                        )
                        .join(', ')}
                </td>
                <td className="font-numeric px-3 py-3.5 text-right text-muted">
                  {p.reorderPoint ?? '—'}
                </td>
                <td className="px-3 py-3.5 text-right">
                  <span
                    className={
                      'font-numeric font-medium ' +
                      (p.lowStock ? 'text-warn' : 'text-ink')
                    }
                  >
                    {qty(p.currentStock)}
                  </span>
                  {p.lowStock && (
                    <span className="ml-1.5 text-caption text-warn">Low</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProductDrawer productId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
