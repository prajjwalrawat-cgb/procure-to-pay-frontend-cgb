'use client';

import { Button, PageHeader } from '@/components/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAdjustStock, useCreateProduct, useLocations } from '@/lib/api/inventory';
import {
  Field,
  FormResult,
  LocationSelect,
  TextArea,
  TextInput,
} from '../../_components/form-controls';

/**
 * Add a single product by hand — the counterpart to Bulk upload for the
 * day-to-day case of one new SKU arriving.
 *
 * `code` is never entered: it is generated server-side as {CATEGORY}-{000123}.
 * Opening stock is optional and, when given, posts as an ADJUSTMENT ledger entry
 * rather than a column on the product, so it stays visible in history.
 */
export default function NewProductPage(): React.JSX.Element {
  const router = useRouter();
  const create = useCreateProduct();
  const adjust = useAdjustStock();
  const locations = useLocations();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [colour, setColour] = useState('');
  const [barcode, setBarcode] = useState('');
  const [batchTracked, setBatchTracked] = useState(false);
  const [unit, setUnit] = useState('pcs');
  const [reorderPoint, setReorderPoint] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [expiry, setExpiry] = useState('');
  const [remark, setRemark] = useState('');
  const [openingStock, setOpeningStock] = useState('');
  const [locationId, setLocationId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const needsLocation = Number(openingStock) > 0;
  const ready = name.trim() && category.trim() && (!needsLocation || locationId);

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        category: category.trim(),
        colour: colour.trim() || null,
        barcode: barcode.trim() || null,
        requiresBatchTracking: batchTracked,
        unit: unit.trim() || 'pcs',
        reorderPoint: reorderPoint ? Number(reorderPoint) : null,
        imageUrl: imageUrl.trim() || null,
        expiryOrWarrantyDate: expiry ? new Date(expiry).toISOString() : null,
        remark: remark.trim() || null,
      });

      // Opening stock is a ledger entry, never a stored column.
      if (needsLocation) {
        await adjust.mutateAsync({
          productId: res.id,
          locationId,
          signedQty: Number(openingStock),
          reason: 'opening-stock',
        });
      }

      setSuccess(`Created ${res.code}. Redirecting to stock overview…`);
      setTimeout(() => router.push('/inventory'), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the product');
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="New product"
        description="Add one SKU by hand, use Bulk upload for a whole sheet"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/inventory">Cancel</Link>
          </Button>
        }
      />

      <div className="rounded-lg border border-line bg-panel p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Product name" required>
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Candle Holder"
              />
            </Field>
          </div>

          <Field
            label="Category"
            required
            hint="Drives the product-code prefix, e.g. Home Decor → HD-000123."
          >
            <TextInput
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Home Decor"
              list="inventory-categories"
            />
          </Field>
          <datalist id="inventory-categories">
            {['Home Decor', 'Stationery', 'Rainwear', 'Box', 'Uncategorized'].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <Field label="Colour" hint="Part of the duplicate-detection key.">
            <TextInput
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              placeholder="Brass"
            />
          </Field>

          {/* Without a barcode the scanner can only find this product by typing
              its code, so this is the field that decides whether a warehouse can
              actually scan it. */}
          <Field
            label="Barcode"
            hint="EAN / UPC printed on the pack. Needed for scanning."
          >
            <TextInput
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="8901234567890"
            />
          </Field>

          <Field label="Unit">
            <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>

          <Field
            label="Batch tracked"
            hint="Receipts must then carry a batch number and expiry; picking uses oldest-first."
          >
            <label className="flex items-center gap-2 py-2 text-body-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={batchTracked}
                onChange={(e) => setBatchTracked(e.target.checked)}
              />
              <span className="text-muted">Require batch and expiry on receipt</span>
            </label>
          </Field>
          <Field
            label="Reorder point"
            hint="Flags the row as low stock at or below this."
          >
            <TextInput
              type="number"
              min={0}
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Image link">
              <TextInput
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
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
          <div />

          <div className="sm:col-span-2">
            <Field label="Remark">
              <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <h2 className="mb-3 text-h3 font-semibold text-ink">
            Opening stock <span className="text-body-sm font-normal text-muted">(optional)</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantity on hand">
              <TextInput
                type="number"
                min={0}
                value={openingStock}
                onChange={(e) => setOpeningStock(e.target.value)}
              />
            </Field>
            <Field label="At location" required={needsLocation}>
              <LocationSelect value={locationId} onChange={setLocationId} />
            </Field>
          </div>
          {(locations.data?.items ?? []).length === 0 && (
            <p className="mt-2 text-caption text-warn">
              No locations exist yet.{' '}
              <Link href="/inventory/locations" className="underline">
                Create one first
              </Link>{' '}
              if you want to record opening stock.
            </p>
          )}
          <p className="mt-2 text-caption text-muted">
            Recorded as an adjustment ledger entry, so it stays visible in history and can
            never drift from the ledger.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <FormResult error={error} success={success} />
          <Button
            variant="primary"
            size="sm"
            disabled={!ready || create.isPending || adjust.isPending}
            onClick={() => void submit()}
          >
            {create.isPending || adjust.isPending ? 'Creating…' : 'Create product'}
          </Button>
        </div>
      </div>

      <p className="mt-3 text-caption text-muted">
        The product code is generated automatically — you never type it.
      </p>
    </div>
  );
}
