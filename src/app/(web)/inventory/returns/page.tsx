'use client';

import {
  Button,
  PageHeader,
  Pill,
  SubNav,
} from '@/components/ui';
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
import { formatDate } from '@/lib/format';

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
    <div>
      <PageHeader
        title="Returns"
        description="Customer returns &amp; restock decisions, vendor repair tracker"
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

      <SubNav
        className="mb-3"
        items={[
          { key: 'customer', label: 'Customer returns' },
          { key: 'vendor', label: 'Vendor returns' },
        ]}
        value={tab}
        onChange={(k) => setTab(k as 'customer' | 'vendor')}
      />

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
    <div className="mb-6 rounded-lg border border-line bg-panel p-4">
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
          variant="primary"
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
      <h2 className="mb-2 text-micro font-medium text-faint">
        Awaiting restock decision ({rows.length})
      </h2>
      {error && <p className="mb-2 text-caption text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="border-line border-b text-left text-caption text-muted">
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
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted">
                  No returns awaiting a decision.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="font-numeric px-3 py-2 text-caption text-muted">
                  {formatDate(r.txnDate)}
                </td>
                <td className="px-3 py-2">
                  <div className="text-ink">{r.productName}</div>
                  <div className="font-numeric text-micro text-faint">
                    {r.productCode}
                  </div>
                </td>
                <td className="font-numeric px-3 py-2 text-caption text-text">
                  {r.orderId ?? '—'}
                </td>
                <td className="px-3 py-2 text-caption text-muted">
                  {r.productCondition ?? '—'}
                </td>
                <td className="font-numeric px-3 py-2 text-right text-ink">{r.qty}</td>
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
                    className="text-caption font-medium text-success hover:underline"
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
                    className="ml-3 text-caption font-medium text-danger hover:underline"
                  >
                    Write off
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-micro text-faint">
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
          variant="primary"
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
