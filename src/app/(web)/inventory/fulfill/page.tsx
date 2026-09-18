'use client';

import { Button, PageHeader } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useFulfillOrder, useProductStock } from '@/lib/api/inventory';
import {
  Field,
  FormResult,
  LocationSelect,
  ProductSelect,
  SelectInput,
  TextArea,
  TextInput,
} from '../_components/form-controls';

/**
 * Order fulfilment — CUSTOMER_ORDER_OUT, stock-checked.
 *
 * The block on insufficient stock is new: the source sheet has no such control.
 * The override is deliberately a separate, explicit checkbox and is recorded on
 * the ledger entry and in the audit log under its own action.
 */
export default function FulfillPage(): React.JSX.Element {
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('');
  const [platform, setPlatform] = useState('Amazon');
  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [courierName, setCourierName] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [paymentMode, setPaymentMode] = useState('Prepaid');
  const [orderValue, setOrderValue] = useState('');
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fulfill = useFulfillOrder();
  const stock = useProductStock(productId || null);

  const atLocation =
    stock.data?.locations.find((l) => l.locationId === locationId)?.qty ?? 0;
  const short = Number(qty) > atLocation;

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      const res = await fulfill.mutateAsync({
        productId,
        locationId,
        qty: Number(qty),
        platform: platform || null,
        orderId: orderId || null,
        customerName: customerName || null,
        courierName: courierName || null,
        trackingId: trackingId || null,
        paymentMode: paymentMode || null,
        orderValue: orderValue || null,
        allowNegativeStock,
        remark: remark || null,
      });
      setSuccess(`Dispatched (${res.id}).`);
      setQty('');
      setOrderId('');
      setTrackingId('');
      setRemark('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not fulfil the order');
    }
  }

  const ready =
    productId && locationId && Number(qty) > 0 && (!short || allowNegativeStock);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Order fulfilment"
        description="Stock-checked customer dispatch"
        actions={
          <>
            <Link href="/inventory">
              <Button variant="ghost" size="sm">
                Stock overview
              </Button>
            </Link>
          </>
        }
      />

      <div className="rounded-lg border border-line bg-panel p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Product" required>
              <ProductSelect
                value={productId}
                onChange={setProductId}
                search={search}
                onSearchChange={setSearch}
              />
            </Field>
          </div>

          <Field
            label="Pick from location"
            required
            hint={productId && locationId ? `${atLocation} on hand here` : undefined}
          >
            <LocationSelect value={locationId} onChange={setLocationId} />
          </Field>
          <Field label="Quantity" required>
            <TextInput
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>

          <Field label="Platform">
            <SelectInput value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="Amazon">Amazon</option>
              <option value="Shopify">Shopify</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Direct">Direct</option>
            </SelectInput>
          </Field>
          <Field label="Order ID">
            <TextInput value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          </Field>
          <Field label="Customer name">
            <TextInput
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </Field>
          <Field label="Courier">
            <TextInput
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              placeholder="Bluedart, ATS…"
            />
          </Field>
          <Field label="Tracking ID">
            <TextInput
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
            />
          </Field>
          <Field label="Payment mode">
            <SelectInput
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="Prepaid">Prepaid</option>
              <option value="COD">COD</option>
            </SelectInput>
          </Field>
          <Field label="Order value">
            <TextInput
              inputMode="decimal"
              value={orderValue}
              onChange={(e) => setOrderValue(e.target.value)}
            />
          </Field>
          <div className="col-span-2">
            <Field label="Remark">
              <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
            </Field>
          </div>
        </div>

        {short && Number(qty) > 0 && (
          <div className="mt-3 rounded-md border border-warn/40 bg-warn-bg px-3 py-2">
            <p className="text-[12px] text-warn">
              Only {atLocation} on hand at this location — {Number(qty) - atLocation}{' '}
              short.
            </p>
            <label className="mt-1.5 flex items-center gap-2 text-[12px] text-warn">
              <input
                type="checkbox"
                checked={allowNegativeStock}
                onChange={(e) => setAllowNegativeStock(e.target.checked)}
              />
              Ship anyway — record an explicit stock-check override
            </label>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <FormResult error={error} success={success} />
          <Button
            variant="primary"
            size="sm"
            disabled={!ready || fulfill.isPending}
            onClick={() => void submit()}
          >
            {fulfill.isPending ? 'Dispatching…' : 'Dispatch'}
          </Button>
        </div>
      </div>
    </div>
  );
}
