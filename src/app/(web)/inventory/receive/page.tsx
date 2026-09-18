'use client';

import { Button, PageHeader, Pill } from '@/components/ui';
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
import { formatDate } from '@/lib/format';

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
        description="Receive against a PO, then run QC"
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
            label="Purchase order ID"
            required={!nonPo}
            hint="Must be an approved / issued / acknowledged PO."
          >
            <TextInput
              value={poId}
              disabled={nonPo}
              onChange={(e) => setPoId(e.target.value)}
              placeholder="po_01H…"
            />
          </Field>
          <Field label="GRN No.">
            <TextInput value={grnNo} onChange={(e) => setGrnNo(e.target.value)} />
          </Field>

          <div className="col-span-2">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={nonPo}
                onChange={(e) => setNonPo(e.target.checked)}
              />
              Challan-only receipt (no PO)
            </label>
          </div>
          {nonPo && (
            <div className="col-span-2">
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
  const { data, isLoading } = usePendingDispositions();
  const qc = useRecordQc();
  const [error, setError] = useState<string | null>(null);

  const rows = data?.qcPending ?? [];

  return (
    <section>
      <h2 className="mb-2 text-[11px] font-medium text-faint">
        Awaiting QC ({rows.length})
      </h2>
      {error && <p className="mb-2 text-[12px] text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-line border-b text-left text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Received</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Vendor</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="w-64 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  Nothing awaiting inspection.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="font-numeric px-3 py-2 text-[12px] text-muted">
                  {formatDate(r.txnDate)}
                </td>
                <td className="px-3 py-2">
                  <div className="text-ink">{r.productName}</div>
                  <div className="font-numeric text-[11px] text-faint">
                    {r.productCode}
                  </div>
                </td>
                <td className="px-3 py-2 text-[12px] text-text">{r.vendorName ?? '—'}</td>
                <td className="font-numeric px-3 py-2 text-right text-ink">{r.qty}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={qc.isPending}
                    onClick={() => {
                      setError(null);
                      qc.mutate(
                        { id: r.id, qcStatus: 'OK' },
                        { onError: (e) => setError(e.message) },
                      );
                    }}
                    className="text-[12px] font-medium text-success hover:underline"
                  >
                    Pass
                  </button>
                  <button
                    type="button"
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
                    className="ml-3 text-[12px] font-medium text-warn hover:underline"
                  >
                    Reject → return
                  </button>
                  <button
                    type="button"
                    disabled={qc.isPending}
                    onClick={() => {
                      setError(null);
                      qc.mutate(
                        { id: r.id, qcStatus: 'REJECTED', disposition: 'WRITE_OFF' },
                        { onError: (e) => setError(e.message) },
                      );
                    }}
                    className="ml-3 text-[12px] font-medium text-danger hover:underline"
                  >
                    Reject → write off
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Rejected quantity never posts to sellable stock — it routes to a vendor return or
        a write-off, both recorded as their own ledger entries.
      </p>
      <div className="mt-1">
        <Pill variant="gray">Ledger entries are never edited or deleted</Pill>
      </div>
    </section>
  );
}
