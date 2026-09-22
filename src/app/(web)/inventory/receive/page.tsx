'use client';

import { Button, PageHeader, Pill, TableState } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import {
  usePendingDispositions,
  useReceiveStock,
  useRecordQc,
} from '@/lib/api/inventory';
import {
  Field,
  FormResult,
  LocationSelect,
  ProductSelect,
  SelectInput,
  TextArea,
  TextInput,
} from '../_components/form-controls';
import { ConfirmAction } from '../_components/confirm-action';
import { formatDate } from '@/lib/format';
import { usePurchaseOrders } from '@/lib/api/purchase-orders';

/** The statuses the receipt endpoint accepts a PO in (see the field hint). */
const RECEIVABLE_PO_STATUSES = new Set(['APPROVED', 'ISSUED', 'ACKNOWLEDGED']);

/**
 * Goods receipt (GRN) — the warehouse-floor receiving screen, plus the QC queue.
 *
 * A receipt must reference a purchase order. Challan-only receipts, which the
 * source workbook genuinely contains, need the non-PO override and a reason, so
 * the exception is always deliberate and auditable.
 */
export default function ReceivePage(): React.JSX.Element {
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('');
  const [poId, setPoId] = useState('');
  const openPos = usePurchaseOrders('open');
  const receivablePos = (openPos.data?.items ?? []).filter((po) =>
    RECEIVABLE_PO_STATUSES.has(po.status),
  );
  const [nonPo, setNonPo] = useState(false);
  const [nonPoReason, setNonPoReason] = useState('');
  const [grnNo, setGrnNo] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [rate, setRate] = useState('');
  const [taxPct, setTaxPct] = useState('');
  const [damageQty, setDamageQty] = useState('0');
  const [qcStatus, setQcStatus] = useState<'PENDING' | 'OK' | 'REJECTED'>('PENDING');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const receive = useReceiveStock();

  async function submit(): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      const res = await receive.mutateAsync({
        productId,
        locationId,
        qty: Number(qty),
        purchaseOrderId: poId || null,
        nonPoReceipt: nonPo,
        nonPoReason: nonPoReason || null,
        grnNo: grnNo || null,
        invoiceNo: invoiceNo || null,
        rate: rate || null,
        taxPct: taxPct || null,
        damageQty: Number(damageQty || 0),
        qcStatus,
        remark: remark || null,
      });
      setSuccess(`Receipt posted (${res.id}).`);
      setQty('');
      setDamageQty('0');
      setRemark('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post the receipt');
    }
  }

  const ready =
    productId && locationId && Number(qty) > 0 && (nonPo ? nonPoReason : poId);

  return (
    <div>
      <PageHeader
        title="Goods receipt"
        description="Receive stock against a purchase order, then run QC."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/inventory">Stock overview</Link>
          </Button>
        }
      />

      <div className="mb-6 rounded-lg border border-line bg-panel p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Product" required>
              <ProductSelect
                value={productId}
                onChange={setProductId}
                search={search}
                onSearchChange={setSearch}
              />
            </Field>
          </div>

          <Field label="Location" required>
            <LocationSelect value={locationId} onChange={setLocationId} />
          </Field>
          <Field label="Quantity received" required>
            <TextInput
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>

          <Field
            label="Purchase order"
            required={!nonPo}
            hint="Must be an approved / issued / acknowledged PO."
          >
            {/* Picked by number from the open orders; typing a raw id is only
                the fallback when the list cannot be read. */}
            {receivablePos.length > 0 ? (
              <SelectInput
                value={poId}
                disabled={nonPo}
                onChange={(e) => setPoId(e.target.value)}
              >
                <option value="">Select a purchase order…</option>
                {receivablePos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.number} — {po.vendor.name}
                  </option>
                ))}
              </SelectInput>
            ) : (
              <TextInput
                value={poId}
                disabled={nonPo}
                onChange={(e) => setPoId(e.target.value)}
                placeholder={
                  openPos.isLoading ? 'Loading purchase orders…' : 'Purchase order id'
                }
              />
            )}
          </Field>
          <Field label="GRN No.">
            <TextInput value={grnNo} onChange={(e) => setGrnNo(e.target.value)} />
          </Field>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-body-sm text-muted">
              <input
                className="accent-[var(--accent)]"
                type="checkbox"
                checked={nonPo}
                onChange={(e) => setNonPo(e.target.checked)}
              />
              Challan-only receipt (no PO)
            </label>
          </div>
          {nonPo && (
            <div className="sm:col-span-2">
              <Field label="Reason for receiving without a PO" required>
                <TextInput
                  value={nonPoReason}
                  onChange={(e) => setNonPoReason(e.target.value)}
                  placeholder="e.g. Challan 3477, no PO raised"
                />
              </Field>
            </div>
          )}

          <Field label="Invoice No.">
            <TextInput value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </Field>
          <Field label="Rate">
            <TextInput
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
          <Field label="Tax %">
            <TextInput
              inputMode="decimal"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
            />
          </Field>
          <Field
            label="Damaged on arrival"
            hint="Written off immediately — never reaches sellable stock."
          >
            <TextInput
              type="number"
              min={0}
              value={damageQty}
              onChange={(e) => setDamageQty(e.target.value)}
            />
          </Field>

          <Field label="QC status" hint="Rejected stock is held for disposition.">
            <SelectInput
              value={qcStatus}
              onChange={(e) =>
                setQcStatus(e.target.value as 'PENDING' | 'OK' | 'REJECTED')
              }
            >
              <option value="PENDING">Pending inspection</option>
              <option value="OK">Ok</option>
              <option value="REJECTED">Rejected</option>
            </SelectInput>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Remark">
              <TextArea value={remark} onChange={(e) => setRemark(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <FormResult error={error} success={success} />
          <Button
            variant="primary"
            size="sm"
            disabled={!ready || receive.isPending}
            onClick={() => void submit()}
          >
            {receive.isPending ? 'Posting…' : 'Post receipt'}
          </Button>
        </div>
      </div>

      <QcQueue />
    </div>
  );
}

/** Receipts still awaiting a QC verdict (business rule 2). */
function QcQueue(): React.JSX.Element {
  const { data, isLoading, error: loadError, refetch } = usePendingDispositions();
  const qc = useRecordQc();
  const [error, setError] = useState<string | null>(null);

  const rows = data?.qcPending ?? [];

  return (
    <section>
      <h2 className="mb-3 text-h3 font-semibold text-ink">Awaiting QC ({rows.length})</h2>
      {error && <p className="mb-2 text-caption text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <table className="pf-stack w-full text-body-sm">
          <thead className="border-b border-line text-left text-caption text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">Received</th>
              <th className="px-3 py-2.5 font-medium">Product</th>
              <th className="px-3 py-2.5 font-medium">Vendor</th>
              <th className="px-3 py-2.5 text-right font-medium">Qty</th>
              <th className="w-64 px-3 py-2.5 text-right font-medium">
                <span className="sr-only">QC verdict</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <TableState
              colSpan={5}
              isLoading={isLoading}
              error={loadError}
              onRetry={() => void refetch()}
              isEmpty={rows.length === 0}
              empty="Nothing awaiting inspection"
            />
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="font-numeric px-3 py-3.5 text-caption text-muted">
                  {formatDate(r.txnDate)}
                </td>
                <td className="px-3 py-3.5">
                  <div className="text-ink">{r.productName}</div>
                  <div className="font-numeric text-micro text-faint">
                    {r.productCode}
                  </div>
                </td>
                <td className="px-3 py-3.5 text-caption text-text">
                  {r.vendorName ?? '—'}
                </td>
                <td className="font-numeric px-3 py-3.5 text-right text-ink">{r.qty}</td>
                <td className="px-3 py-3.5 text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={qc.isPending}
                      onClick={() => {
                        setError(null);
                        qc.mutate(
                          { id: r.id, qcStatus: 'OK' },
                          { onError: (e) => setError(e.message) },
                        );
                      }}
                    >
                      Pass
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={qc.isPending}
                      onClick={() => {
                        setError(null);
                        qc.mutate(
                          {
                            id: r.id,
                            qcStatus: 'REJECTED',
                            disposition: 'RETURN_TO_VENDOR',
                          },
                          { onError: (e) => setError(e.message) },
                        );
                      }}
                    >
                      Reject → return
                    </Button>
                    <ConfirmAction
                      label="Reject → write off"
                      title={`Reject and write off ${r.qty} × ${r.productName}?`}
                      detail="The receipt fails QC and the quantity posts as a damage write-off. It never reaches sellable stock, and the entry can only be offset later, never removed."
                      confirmLabel="Reject and write off"
                      disabled={qc.isPending}
                      onConfirm={() => {
                        setError(null);
                        qc.mutate(
                          { id: r.id, qcStatus: 'REJECTED', disposition: 'WRITE_OFF' },
                          { onError: (e) => setError(e.message) },
                        );
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-caption text-muted">
        Rejected quantity never posts to sellable stock — it routes to a vendor return or
        a write-off, both recorded as their own ledger entries. Ledger entries are never
        edited or deleted.
      </p>
    </section>
  );
}
