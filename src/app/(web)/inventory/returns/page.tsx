'use client';

import { Button, Pill } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import {
  useCustomerReturn,
  usePendingDispositions,
  useRestockDecision,
  useVendorReturn,
} from '@/lib/api/inventory';
import {
  Field,
  FormResult,
  LocationSelect,
  ProductSelect,
  TextArea,
  TextInput,
} from '../_components/form-controls';

/**
 * Returns — customer return intake with its restock decision, plus the vendor
 * return / repair tracker.
 *
 * A customer return posts inward immediately (the goods are physically back)
 * but lands pending a decision. Choosing "do not restock" writes a
 * DAMAGE_WRITE_OFF rather than editing the return, keeping the ledger insert-only.
 */
export default function ReturnsPage(): React.JSX.Element {
  const [tab, setTab] = useState<'customer' | 'vendor'>('customer');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">Returns</h1>
          <p className="text-muted text-[13px]">
            Customer returns &amp; restock decisions · vendor repair tracker
          </p>
        </div>
        <Link href="/inventory">
          <Button variant="ghost" size="sm">
            Stock overview
          </Button>
        </Link>
      </div>

      <div className="border-line mb-3 flex items-center gap-1 border-b">
        {(
          [
            ['customer', 'Customer returns'],
            ['vendor', 'Vendor returns'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              'border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ' +
              (tab === k
                ? 'border-accent text-ink'
                : 'text-muted hover:text-ink border-transparent')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'customer' ? (
        <>
          <CustomerReturnForm />
          <RestockQueue />
        </>
      ) : (
        <VendorReturnForm />
      )}
    </div>
  );
}

function CustomerReturnForm(): React.JSX.Element {
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('');
  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [productCondition, setProductCondition] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ret = useCustomerReturn();

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      const res = await ret.mutateAsync({
        productId,
        locationId,
        qty: Number(qty),
        orderId: orderId || null,
        customerName: customerName || null,
        returnReason: returnReason || null,
        productCondition: productCondition || null,
        remark: remark || null,
      });
      setSuccess(`Return received (${res.id}) — awaiting a restock decision.`);
      setQty('');
      setRemark('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the return');
    }
  }

  const ready = productId && locationId && Number(qty) > 0;

  return (
    <div className="border-line bg-panel mb-6 rounded-lg border p-4">
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
        <Field label="Return into location" required>
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
        <Field label="Order ID">
          <TextInput value={orderId} onChange={(e) => setOrderId(e.target.value)} />
        </Field>
        <Field label="Customer name">
          <TextInput
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </Field>
        <Field label="Reason">
          <TextInput
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
          />
        </Field>
        <Field label="Product condition" hint="Drives the restock decision.">
          <TextInput
            value={productCondition}
            onChange={(e) => setProductCondition(e.target.value)}
            placeholder="Sealed, box damaged, used…"
          />
        </Field>
        <div className="col-span-2">
          <Field label="Remark">
            <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <FormResult error={error} success={success} />
        <Button
          variant="accent"
          size="sm"
          disabled={!ready || ret.isPending}
          onClick={() => void submit()}
        >
          {ret.isPending ? 'Recording…' : 'Receive return'}
        </Button>
      </div>
    </div>
  );
}

function RestockQueue(): React.JSX.Element {
  const { data, isLoading } = usePendingDispositions();
  const decide = useRestockDecision();
  const [error, setError] = useState<string | null>(null);
  const rows = data?.restockPending ?? [];

  return (
    <section>
      <h2 className="text-faint mb-2 text-[11px] font-medium uppercase tracking-wide">
        Awaiting restock decision ({rows.length})
      </h2>
      {error && <p className="mb-2 text-[12px] text-red-600">{error}</p>}
      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 font-medium">Returned</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Condition</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-52 px-3 py-2" />
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
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted px-3 py-8 text-center">
                  No returns awaiting a decision.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-line border-t">
                <td className="font-numeric text-muted px-3 py-2 text-[12px]">
                  {new Date(r.txnDate).toLocaleDateString('en-IN')}
                </td>
                <td className="px-3 py-2">
                  <div className="text-ink">{r.productName}</div>
                  <div className="font-numeric text-faint text-[11px]">
                    {r.productCode}
                  </div>
                </td>
                <td className="font-numeric text-text px-3 py-2 text-[12px]">
                  {r.orderId ?? '—'}
                </td>
                <td className="text-muted px-3 py-2 text-[12px]">
                  {r.productCondition ?? '—'}
                </td>
                <td className="font-numeric text-ink px-3 py-2 text-right">{r.qty}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={decide.isPending}
                    onClick={() => {
                      setError(null);
                      decide.mutate(
                        { id: r.id, restock: true },
                        { onError: (e) => setError(e.message) },
                      );
                    }}
                    className="text-[12px] font-medium text-emerald-700 hover:underline"
                  >
                    Restock
                  </button>
                  <button
                    type="button"
                    disabled={decide.isPending}
                    onClick={() => {
                      setError(null);
                      decide.mutate(
                        { id: r.id, restock: false },
                        { onError: (e) => setError(e.message) },
                      );
                    }}
                    className="ml-3 text-[12px] font-medium text-red-600 hover:underline"
                  >
                    Write off
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-faint mt-2 text-[11px]">
        Writing off posts a DAMAGE_WRITE_OFF entry linked to the return — the return
        itself is never edited.
      </p>
    </section>
  );
}

function VendorReturnForm(): React.JSX.Element {
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [purpose, setPurpose] = useState('Repair');
  const [tentativeReturnDate, setTentativeReturnDate] = useState('');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ret = useVendorReturn();

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      const res = await ret.mutateAsync({
        productId,
        locationId,
        qty: Number(qty),
        gatePassNo: gatePassNo || null,
        invoiceNo: invoiceNo || null,
        purpose: purpose || null,
        tentativeReturnDate: tentativeReturnDate
          ? new Date(tentativeReturnDate).toISOString()
          : null,
        remark: remark || null,
      });
      setSuccess(`Gate pass recorded (${res.id}).`);
      setQty('');
      setRemark('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the vendor return');
    }
  }

  const ready = productId && locationId && Number(qty) > 0;

  return (
    <div className="border-line bg-panel rounded-lg border p-4">
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
        <Field label="Send from location" required>
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
        <Field label="Gate pass no.">
          <TextInput value={gatePassNo} onChange={(e) => setGatePassNo(e.target.value)} />
        </Field>
        <Field label="Against invoice / challan">
          <TextInput value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </Field>
        <Field label="Purpose">
          <TextInput value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </Field>
        <Field label="Tentative return date">
          <TextInput
            type="date"
            value={tentativeReturnDate}
            onChange={(e) => setTentativeReturnDate(e.target.value)}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Remark">
            <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <FormResult error={error} success={success} />
        <Button
          variant="accent"
          size="sm"
          disabled={!ready || ret.isPending}
          onClick={() => void submit()}
        >
          {ret.isPending ? 'Recording…' : 'Record vendor return'}
        </Button>
      </div>
      <div className="mt-3">
        <Pill variant="gray">
          Stock leaves immediately — the ledger records the outward movement
        </Pill>
      </div>
    </div>
  );
}
