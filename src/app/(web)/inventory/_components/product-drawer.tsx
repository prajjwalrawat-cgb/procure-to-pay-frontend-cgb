'use client';

import { Button, Pill } from '@/components/ui';
import type { ProductDetailResponse } from '@/lib/shared';
import { useState } from 'react';

import { useDeactivateProduct, useProduct, useUpdateProduct } from '@/lib/api/inventory';
import { Field, FormResult, TextArea, TextInput } from './form-controls';
import { ProductThumb } from './product-thumb';

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
  const { data, isLoading } = useProduct(productId);
  const [editing, setEditing] = useState(false);

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
          <div className="flex shrink-0 items-center gap-3">
            {data && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-accent-2 text-[13px] font-medium hover:underline"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-ink text-[13px]"
            >
              Close
            </button>
          </div>
        </header>

        {data && editing && (
          <EditForm product={data} onDone={() => setEditing(false)} />
        )}

        {data && !editing && (
          <div className="flex flex-col gap-5 px-5 py-4">
            {data.imageUrl && (
              <div className="flex items-center gap-3">
                <ProductThumb url={data.imageUrl} alt={data.name} size={72} />
                <a
                  href={data.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-2 text-[12px] hover:underline"
                >
                  Open product image ↗
                </a>
              </div>
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
              <p className="text-faint mt-1.5 text-[11px]">
                Summed from the ledger, so they are not editable. Use{' '}
                <a
                  href="/inventory/adjustments"
                  className="text-accent-2 hover:underline"
                >
                  Adjustments
                </a>{' '}
                to correct a figure.
              </p>
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
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
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
        <Field label="Unit" required>
          <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} />
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
        <div className="col-span-2">
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
        <div className="col-span-2">
          <Field label="Remark">
            <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
        </div>
      </div>

      <p className="text-faint text-[11px]">
        Product code {product.code} is generated by the system and cannot be
        changed. Stock quantities are not editable here.
      </p>

      <FormResult error={error} success={success} />

      <div className="border-line flex items-center justify-between border-t pt-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleActive()}
          className={
            'text-[12px] font-medium hover:underline ' +
            (product.active ? 'text-red-600' : 'text-emerald-700')
          }
        >
          {product.active ? 'Retire product' : 'Reactivate product'}
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onDone}>
            Cancel
          </Button>
          <Button
            variant="accent"
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
