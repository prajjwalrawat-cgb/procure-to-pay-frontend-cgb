'use client';

import { Button, Pill } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useLocations, useProducts } from '@/lib/api/inventory';
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
  const { data, isLoading } = useProducts({
    q: q || undefined,
    locationId: locationId || undefined,
    lowStock: lowStock || undefined,
    limit: 100,
  });

  const items = data?.items ?? [];
  const lowCount = items.filter((i) => i.lowStock).length;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            Stock overview
          </h1>
          <p className="text-muted text-[13px]">
            {data?.totalEstimate ?? 0} products
            {lowCount > 0 && ` · ${lowCount} at or below reorder point`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory/bulk-upload">
            <Button variant="ghost" size="sm">
              Bulk upload
            </Button>
          </Link>
          <Link href="/inventory/products/new">
            <Button variant="accent" size="sm">
              New product
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, code, colour or legacy SKU…"
          className="border-line bg-panel text-text placeholder:text-faint focus:border-accent min-w-[260px] flex-1 rounded-md border px-3 py-1.5 text-[13px] outline-none"
        />
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
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => setLowStock(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
            <tr>
              <th className="w-12 px-3 py-2 text-right font-medium">S. No.</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Locations</th>
              <th className="px-3 py-2 text-right font-medium">Reorder</th>
              <th className="px-3 py-2 text-right font-medium">Current stock</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-muted px-3 py-8 text-center">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted px-3 py-8 text-center">
                  {q || locationId || lowStock ? (
                    'No products match this view.'
                  ) : (
                    <>
                      No products yet. Start by adding a{' '}
                      <Link href="/inventory/locations" className="text-accent-2 underline">
                        location
                      </Link>
                      , then{' '}
                      <Link
                        href="/inventory/products/new"
                        className="text-accent-2 underline"
                      >
                        create a product
                      </Link>{' '}
                      or{' '}
                      <Link
                        href="/inventory/bulk-upload"
                        className="text-accent-2 underline"
                      >
                        bulk upload a sheet
                      </Link>
                      .
                    </>
                  )}
                </td>
              </tr>
            )}
            {items.map((p, i) => (
              <tr
                key={p.id}
                onClick={() => setSelected(p.id)}
                className="border-line hover:bg-canvas/60 cursor-pointer border-t"
              >
                {/* Position in the current view, so it renumbers with filters. */}
                <td className="font-numeric text-faint px-3 py-2 text-right text-[12px]">
                  {i + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <ProductThumb url={p.imageUrl} alt={p.name} />
                    <div className="min-w-0">
                      <div className="text-ink truncate font-medium">{p.name}</div>
                      <div className="font-numeric text-faint text-[11px]">
                        {p.code}
                        {p.colour ? ` · ${p.colour}` : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Pill variant={p.category === 'Uncategorized' ? 'gray' : 'info'}>
                    {p.category}
                  </Pill>
                </td>
                <td className="text-muted px-3 py-2 text-[12px]">
                  {p.locations.length === 0
                    ? '—'
                    : p.locations
                        .map(
                          (l) =>
                            `${l.locationName}${l.rackNo ? ` (${l.rackNo})` : ''} ${l.qty}`,
                        )
                        .join(' · ')}
                </td>
                <td className="font-numeric text-muted px-3 py-2 text-right">
                  {p.reorderPoint ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={
                      'font-numeric font-medium ' +
                      (p.lowStock ? 'text-amber-700' : 'text-ink')
                    }
                  >
                    {p.currentStock.toLocaleString('en-IN')}
                  </span>
                  {p.lowStock && (
                    <Pill variant="warn" className="ml-1.5">
                      Low
                    </Pill>
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
