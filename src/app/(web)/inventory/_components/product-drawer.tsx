'use client';

import { Button, ErrorState, Pill, Skeleton } from '@/components/ui';
import type { ProductDetailResponse } from '@/lib/shared';
import { useState } from 'react';

import { useDeactivateProduct, useProduct, useUpdateProduct } from '@/lib/api/inventory';
import { Field, FormResult, TextArea, TextInput } from './form-controls';
import { ProductThumb } from './product-thumb';
import { formatDate, formatDateTime } from '@/lib/format';

/**
 * Product detail drawer — the one place a warehouse user can confirm that
 * nothing from the legacy Master Inventory Sheet was lost. Every column of that
 * sheet is answerable here: the ones superseded by `code` (legacy Product ID /
 * SKU) are shown explicitly rather than quietly dropped, and the six derived
 * figures come from `product_stock_summary`, not from stored Product columns.
 *
 * Keyed on the product so opening a different one always starts in read mode
 * with a clean form.
 */
export function ProductDrawer({
  productId,
  onClose,
}: {
  productId: string | null;
  onClose: () => void;
}): React.JSX.Element | null {
  if (!productId) return null;
  return <Drawer key={productId} productId={productId} onClose={onClose} />;
}

function Drawer({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}): React.JSX.Element {
  const { data, isLoading, error, refetch } = useProduct(productId);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/20"
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-panel">
        <header className="sticky top-0 flex items-start justify-between border-b border-line bg-panel px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-h3 font-semibold tracking-heading text-ink">
              {isLoading ? <Skeleton className="h-5 w-48" /> : data?.name}
            </h2>
            <p className="font-numeric text-caption text-muted">
              {data?.code}
              {data?.colour ? ` — ${data.colour}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {data && !editing && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        {isLoading && (
          <div aria-busy="true" className="flex flex-col gap-3 px-5 py-4">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {error && !isLoading && (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}

        {data && editing && <EditForm product={data} onDone={() => setEditing(false)} />}

        {data && !editing && (
          <div className="flex flex-col gap-5 px-5 py-4">
            {data.imageUrl && (
              <div className="flex items-center gap-3">
                <ProductThumb url={data.imageUrl} alt={data.name} size={72} />
                <a
                  href={data.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-caption text-accent hover:underline"
                >
                  Open product image ↗
                </a>
              </div>
            )}

            {/* Every derived Master Inventory Sheet column, from the ledger view. */}
            <section>
              <SectionTitle>Stock summary</SectionTitle>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
                <Stat label="Opening stock" value={data.summary.openingStock} />
                <Stat label="Received" value={data.summary.totalIn} />
                <Stat label="Issued out" value={data.summary.totalOut} />
                <Stat label="Returned" value={data.summary.returnQty} />
                <Stat label="Damaged" value={data.summary.damageQty} />
                <Stat
                  label="Current stock"
                  value={data.summary.currentStock}
                  emphasis
                  warn={data.lowStock}
                />
              </div>
              {data.lowStock && (
                <p className="mt-1.5 text-caption text-warn">
                  At or below the reorder point of {data.reorderPoint}.
                </p>
              )}
              <p className="mt-1.5 text-caption text-muted">
                Summed from the ledger, so they are not editable. Use{' '}
                <a href="/inventory/adjustments" className="text-accent hover:underline">
                  Adjustments
                </a>{' '}
                to correct a figure.
              </p>
            </section>

            <section>
              <SectionTitle>Location &amp; Rack No.</SectionTitle>
              {data.locations.length === 0 ? (
                <p className="text-body-sm text-muted">No stock on hand.</p>
              ) : (
                <table className="w-full text-body-sm">
                  <thead className="border-b border-line text-left text-caption text-muted">
                    <tr>
                      <th className="py-2 font-medium">Location</th>
                      <th className="py-2 font-medium">Rack No.</th>
                      <th className="py-2 text-right font-medium">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.locations.map((l) => (
                      <tr key={l.locationId} className="border-t border-line">
                        <td className="py-2.5 text-text">{l.locationName}</td>
                        <td className="py-2.5 text-muted">{l.rackNo ?? '—'}</td>
                        <td className="font-numeric py-2.5 text-right font-medium text-ink">
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
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-body-sm">
                <Row label="Category">
                  {data.category === 'Uncategorized' ? (
                    <span className="text-faint">Uncategorised</span>
                  ) : (
                    data.category
                  )}
                </Row>
                <Row label="Colour">{data.colour ?? '—'}</Row>
                <Row label="Barcode">
                  {data.barcode ?? (
                    <span className="text-faint">not set — scan by product code</span>
                  )}
                </Row>
                <Row label="Batch tracked">
                  {data.requiresBatchTracking ? 'Yes' : 'No'}
                </Row>
                <Row label="Unit">{data.unit}</Row>
                <Row label="Reorder point">{data.reorderPoint ?? '—'}</Row>
                <Row label="Expiry / warranty">
                  {data.expiryOrWarrantyDate
                    ? formatDate(data.expiryOrWarrantyDate)
                    : '—'}
                </Row>
                <Row label="Last updated">{formatDateTime(data.updatedAt)}</Row>
                <Row label="Status">
                  <Pill variant={data.active ? 'success' : 'neutral'} dot>
                    {data.active ? 'Active' : 'Retired'}
                  </Pill>
                </Row>
              </dl>
            </section>

            {/* Superseded by `code`, kept so the old sheet stays fully auditable. */}
            <section>
              <SectionTitle>Legacy references</SectionTitle>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-body-sm">
                <Row label="Product ID">
                  <span className="font-numeric text-muted">
                    {data.legacyProductId ?? '—'}
                  </span>
                </Row>
                <Row label="SKU">
                  <span className="font-numeric text-muted">{data.legacySku ?? '—'}</span>
                </Row>
                <Row label="Imported by">
                  <span className="font-numeric text-caption text-muted">
                    {data.createdFromImportBatchId ?? 'Created manually'}
                  </span>
                </Row>
                <Row label="Linked item">
                  <span className="font-numeric text-caption text-muted">
                    {data.itemId ?? 'Not linked to the item master'}
                  </span>
                </Row>
              </dl>
            </section>

            <section>
              <SectionTitle>Remark</SectionTitle>
              <p className="whitespace-pre-wrap text-body-sm text-text">
                {data.remark || <span className="text-muted">No notes.</span>}
              </p>
            </section>
          </div>
        )}
      </aside>
    </>
  );
}

/** `YYYY-MM-DD` for a date input, from a nullable ISO timestamp. */
function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

/**
 * Edits the descriptive fields only. `code` is server-generated so it has no
 * input, and there is deliberately no stock field — see the drawer docblock.
 */
function EditForm({
  product,
  onDone,
}: {
  product: ProductDetailResponse;
  onDone: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category);
  const [colour, setColour] = useState(product.colour ?? '');
  const [barcode, setBarcode] = useState(product.barcode ?? '');
  const [batchTracked, setBatchTracked] = useState(product.requiresBatchTracking);
  const [unit, setUnit] = useState(product.unit);
  const [reorderPoint, setReorderPoint] = useState(
    product.reorderPoint === null ? '' : String(product.reorderPoint),
  );
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? '');
  const [expiry, setExpiry] = useState(toDateInput(product.expiryOrWarrantyDate));
  const [remark, setRemark] = useState(product.remark ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const update = useUpdateProduct();
  const deactivate = useDeactivateProduct();

  async function save(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      await update.mutateAsync({
        id: product.id,
        name: name.trim(),
        category: category.trim(),
        colour: colour.trim() || null,
        barcode: barcode.trim() || null,
        requiresBatchTracking: batchTracked,
        unit: unit.trim(),
        // Blank clears the value; the API rejects '' because it must be a URL.
        imageUrl: imageUrl.trim() || null,
        reorderPoint: reorderPoint === '' ? null : Number(reorderPoint),
        expiryOrWarrantyDate: expiry ? new Date(expiry).toISOString() : null,
        remark: remark.trim() || null,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the product');
    }
  }

  async function toggleActive(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      if (product.active) {
        await deactivate.mutateAsync(product.id);
        setSuccess('Product retired. Its ledger history is unchanged.');
      } else {
        await update.mutateAsync({ id: product.id, active: true });
        setSuccess('Product reactivated.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the status');
    }
  }

  const busy = update.isPending || deactivate.isPending;
  const ready = !!name.trim() && !!category.trim() && !!unit.trim();

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Field label="Category" required>
          <TextInput value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <Field label="Colour">
          <TextInput value={colour} onChange={(e) => setColour(e.target.value)} />
        </Field>
        {/* The field that makes an existing product scannable. Editable here
            because a catalogue gets barcoded long after it was created. */}
        <Field
          label="Barcode"
          hint="EAN / UPC on the pack. Blank = scan by product code only."
        >
          <TextInput
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="8901234567890"
          />
        </Field>
        <Field label="Unit" required>
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field
          label="Batch tracked"
          hint="Receipts must carry a batch number and expiry; picking goes oldest-first."
        >
          <label className="flex items-center gap-2 py-1 text-body-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={batchTracked}
              onChange={(e) => setBatchTracked(e.target.checked)}
            />
            <span className="text-muted">Require batch and expiry</span>
          </label>
        </Field>
        <Field label="Reorder point" hint="Blank means no low-stock alert.">
          <TextInput
            type="number"
            min={0}
            step={1}
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Image URL">
            <TextInput
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>
        <Field label="Expiry / warranty date">
          <TextInput
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Remark">
            <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
        </div>
      </div>

      <p className="text-micro text-faint">
        Product code {product.code} is generated by the system and cannot be changed.
        Stock quantities are not editable here.
      </p>

      <FormResult error={error} success={success} />

      <div className="flex items-center justify-between border-t border-line pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleActive()}
          // Retiring is reversible (Reactivate below), so it is a quiet text
          // action rather than a red one; red is kept for confirm steps.
          className="text-caption font-medium text-muted hover:text-text hover:underline disabled:opacity-50"
        >
          {product.active ? 'Retire product' : 'Reactivate product'}
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onDone}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!ready || busy}
            onClick={() => void save()}
          >
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h3 className="mb-2 text-body-sm font-semibold text-ink">{children}</h3>;
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
      <div className="text-micro text-faint">{label}</div>
      <div
        className={
          'font-numeric tabular-nums ' +
          (emphasis ? 'text-h2 font-semibold' : 'text-h3') +
          (warn ? 'text-warn' : 'text-ink')
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
