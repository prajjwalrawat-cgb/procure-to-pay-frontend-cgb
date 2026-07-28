'use client';

import { Pill } from '@/components/ui';

import { useProduct } from '@/lib/api/inventory';

/**
 * Product detail drawer — the one place a warehouse user can confirm that
 * nothing from the legacy Master Inventory Sheet was lost. Every column of that
 * sheet is answerable here: the ones superseded by `code` (legacy Product ID /
 * SKU) are shown explicitly rather than quietly dropped, and the six derived
 * figures come from `product_stock_summary`, not from stored Product columns.
 */
export function ProductDrawer({
  productId,
  onClose,
}: {
  productId: string | null;
  onClose: () => void;
}): React.JSX.Element | null {
  const { data, isLoading } = useProduct(productId);
  if (!productId) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/20"
      />
      <aside className="border-line bg-panel fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l shadow-xl">
        <header className="border-line bg-panel sticky top-0 flex items-start justify-between border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="tracking-heading text-ink truncate text-[16px] font-semibold">
              {isLoading ? 'Loading…' : data?.name}
            </h2>
            <p className="font-numeric text-muted text-[12px]">
              {data?.code}
              {data?.colour ? ` · ${data.colour}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink shrink-0 text-[13px]"
          >
            Close
          </button>
        </header>

        {data && (
          <div className="flex flex-col gap-5 px-5 py-4">
            {data.imageUrl && (
              <a
                href={data.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent-2 text-[12px] hover:underline"
              >
                Open product image ↗
              </a>
            )}

            {/* Every derived Master Inventory Sheet column, from the ledger view. */}
            <section>
              <SectionTitle>Stock summary</SectionTitle>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                <Stat label="Opening Stock" value={data.summary.openingStock} />
                <Stat label="IN" value={data.summary.totalIn} />
                <Stat label="Total Out" value={data.summary.totalOut} />
                <Stat label="Return Qty." value={data.summary.returnQty} />
                <Stat label="Damage Qty." value={data.summary.damageQty} />
                <Stat
                  label="Current Stock"
                  value={data.summary.currentStock}
                  emphasis
                  warn={data.lowStock}
                />
              </div>
              {data.lowStock && (
                <p className="text-[11px] text-amber-700 mt-1.5">
                  At or below the reorder point of {data.reorderPoint}.
                </p>
              )}
            </section>

            <section>
              <SectionTitle>Location &amp; Rack No.</SectionTitle>
              {data.locations.length === 0 ? (
                <p className="text-muted text-[13px]">No stock on hand.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="text-faint text-left text-[11px] uppercase tracking-wide">
                    <tr>
                      <th className="py-1 font-medium">Location</th>
                      <th className="py-1 font-medium">Rack No.</th>
                      <th className="py-1 text-right font-medium">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.locations.map((l) => (
                      <tr key={l.locationId} className="border-line border-t">
                        <td className="text-text py-1.5">{l.locationName}</td>
                        <td className="text-muted py-1.5">{l.rackNo ?? '—'}</td>
                        <td className="font-numeric text-ink py-1.5 text-right font-medium">
                          {l.qty.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section>
              <SectionTitle>Product details</SectionTitle>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-[13px]">
                <Row label="Category">
                  <Pill variant={data.category === 'Uncategorized' ? 'gray' : 'info'}>
                    {data.category}
                  </Pill>
                </Row>
                <Row label="Colour">{data.colour ?? '—'}</Row>
                <Row label="Unit">{data.unit}</Row>
                <Row label="Reorder point">{data.reorderPoint ?? '—'}</Row>
                <Row label="Expiry/Warranty">
                  {data.expiryOrWarrantyDate
                    ? new Date(data.expiryOrWarrantyDate).toLocaleDateString('en-IN')
                    : '—'}
                </Row>
                <Row label="Last Updated">
                  {new Date(data.updatedAt).toLocaleString('en-IN')}
                </Row>
                <Row label="Status">
                  <Pill variant={data.active ? 'success' : 'gray'} dot>
                    {data.active ? 'Active' : 'Retired'}
                  </Pill>
                </Row>
              </dl>
            </section>

            {/* Superseded by `code`, kept so the old sheet stays fully auditable. */}
            <section>
              <SectionTitle>Legacy references</SectionTitle>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-[13px]">
                <Row label="Product ID">
                  <span className="font-numeric text-muted">
                    {data.legacyProductId ?? '—'}
                  </span>
                </Row>
                <Row label="SKU">
                  <span className="font-numeric text-muted">{data.legacySku ?? '—'}</span>
                </Row>
                <Row label="Imported by">
                  <span className="font-numeric text-muted text-[12px]">
                    {data.createdFromImportBatchId ?? 'Created manually'}
                  </span>
                </Row>
                <Row label="Linked item">
                  <span className="font-numeric text-muted text-[12px]">
                    {data.itemId ?? 'Not linked to the item master'}
                  </span>
                </Row>
              </dl>
            </section>

            <section>
              <SectionTitle>Remark</SectionTitle>
              <p className="text-text whitespace-pre-wrap text-[13px]">
                {data.remark || <span className="text-muted">No notes.</span>}
              </p>
            </section>
          </div>
        )}
      </aside>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <h3 className="text-faint mb-2 text-[11px] font-medium uppercase tracking-wide">
      {children}
    </h3>
  );
}

function Stat({
  label,
  value,
  emphasis,
  warn,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  warn?: boolean;
}): React.JSX.Element {
  return (
    <div className="bg-panel px-3 py-2">
      <div className="text-faint text-[11px]">{label}</div>
      <div
        className={
          'font-numeric tabular-nums ' +
          (emphasis ? 'text-[18px] font-semibold ' : 'text-[15px] ') +
          (warn ? 'text-amber-700' : 'text-ink')
        }
      >
        {value.toLocaleString('en-IN')}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-text">{children}</dd>
    </>
  );
}
