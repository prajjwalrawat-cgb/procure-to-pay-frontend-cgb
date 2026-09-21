'use client';

import { Button, Input, PageHeader } from '@/components/ui';
import { Money, type InvoiceDocumentKind, type VendorPoOption } from '@/lib/shared';
import { percentToRate, rateToPercent } from '@/lib/rate';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileDrop } from '@/vendor/components/invoices/file-drop';
import { PoSelectModal } from '@/vendor/components/invoices/po-select-modal';
import {
  uploadInvoiceFile,
  useOpenPos,
  useSubmitInvoice,
} from '@/vendor/lib/api/invoices';

interface LineDraft {
  lineNo: number;
  itemDesc: string;
  uom: string;
  qty: string;
  unitPrice: string;
  /** Held as a **percentage** ('5'), like the buyer forms; converted on submit. */
  taxRate: string;
  poLineId: string | null;
  /** Ordered / received / already billed, so the row can show its own arithmetic. */
  qtyOrdered: string;
  qtyReceived: string;
  qtyInvoiced: string;
  /** What the matcher will accept on this line. Seeds `qty`. */
  qtyBillable: string;
}

// v2: taxRate switched from a wire fraction ('0.05') to a percentage ('5'), so
// v1 drafts must not be restored into the new field.
const DRAFT_KEY = (poId: string): string => `vendor-invoice-draft:v2:${poId}`;
const today = (): string => new Date().toISOString().slice(0, 10);
const inr = (v: string | number): string => Money.of(v || 0).toINR();
const amountOf = (l: LineDraft): string =>
  Money.of(l.qty || 0)
    .multiply(l.unitPrice || 0)
    .toString();
/**
 * Where the billable figure came from, in the supplier's own terms. They have
 * no view of the buyer's goods receipts, so an unexplained quantity that is not
 * the one on their PO reads as a mistake by the portal.
 */
const basisLabel = (l: LineDraft): string => {
  const parts = [`${l.qtyOrdered} ordered`];
  if (Number(l.qtyReceived) > 0) parts.push(`${l.qtyReceived} received`);
  if (Number(l.qtyInvoiced) > 0) parts.push(`${l.qtyInvoiced} already invoiced`);
  parts.push(`${l.qtyBillable} billable`);
  return parts.join(', ');
};

/** Warn, never block: over-billing is the buyer's call, not the portal's. */
const overBillable = (l: LineDraft): boolean =>
  Number(l.qty || 0) > Number(l.qtyBillable || 0);

/** GST on a line, at the percentage the vendor is billing. */
const taxOf = (l: LineDraft): string =>
  Money.of(amountOf(l))
    .percent(Number(l.taxRate) || 0)
    .toString();

export default function SubmitInvoicePage(): React.JSX.Element {
  const router = useRouter();
  const { data: pos, isLoading } = useOpenPos();
  const submit = useSubmitInvoice();

  const [po, setPo] = useState<VendorPoOption | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [documentKind, setDocumentKind] = useState<InvoiceDocumentKind>('TAX_INVOICE');
  const isProforma = documentKind === 'PROFORMA';
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [irn, setIrn] = useState('');
  const [ewaybill, setEwaybill] = useState('');
  const [taxFiles, setTaxFiles] = useState<File[]>([]);
  const [supportFiles, setSupportFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const backToList = (): void => router.push('/vendor/invoices');

  const pickPo = (selected: VendorPoOption): void => {
    const seeded: LineDraft[] = selected.lines.map((l) => ({
      lineNo: l.lineNo,
      itemDesc: l.itemDesc,
      uom: l.uom,
      // Seeded from what is still billable, NOT from the full ordered quantity.
      // On a part-billed or part-received PO the ordered figure is one the
      // matcher will reject outright, and offering it as the default walks the
      // supplier into an exception this form had the data to prevent.
      qty: l.qtyBillable,
      unitPrice: l.unitPrice,
      taxRate: rateToPercent(l.taxRate),
      poLineId: l.id,
      qtyOrdered: l.qtyOrdered,
      qtyReceived: l.qtyReceived,
      qtyInvoiced: l.qtyInvoiced,
      qtyBillable: l.qtyBillable,
    }));
    // Restore a device-local draft for this PO if one exists.
    const raw =
      typeof window !== 'undefined' ? localStorage.getItem(DRAFT_KEY(selected.id)) : null;
    if (raw) {
      try {
        const d = JSON.parse(raw) as Partial<{
          invoiceNumber: string;
          invoiceDate: string;
          irn: string;
          ewaybill: string;
          lines: LineDraft[];
        }>;
        setInvoiceNumber(d.invoiceNumber ?? '');
        setInvoiceDate(d.invoiceDate ?? today());
        setIrn(d.irn ?? '');
        setEwaybill(d.ewaybill ?? '');
        setLines(d.lines?.length ? d.lines : seeded);
      } catch {
        setLines(seeded);
      }
    } else {
      setLines(seeded);
    }
    setPo(selected);
  };

  const updateLine = (i: number, patch: Partial<LineDraft>): void =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const invoiceSubtotal = lines.reduce((acc, l) => acc.add(amountOf(l)), Money.zero());
  const invoiceTax = lines.reduce((acc, l) => acc.add(taxOf(l)), Money.zero());
  const invoiceTotal = invoiceSubtotal.add(invoiceTax.toString());

  const canSubmit =
    invoiceNumber.trim().length > 0 &&
    invoiceDate.length > 0 &&
    taxFiles.length > 0 &&
    lines.some((l) => Number(l.qty) > 0);

  const buildPayload = (s3Key: string) => ({
    poId: po!.id,
    vendorInvoiceRef: invoiceNumber.trim(),
    invoiceDate: new Date(`${invoiceDate}T00:00:00.000Z`).toISOString(),
    s3Key,
    documentKind,
    irn: irn || null,
    ewaybillNo: ewaybill || null,
    lines: lines.map((l) => ({
      lineNo: l.lineNo,
      itemDesc: l.itemDesc,
      uom: l.uom,
      qty: l.qty,
      unitPrice: l.unitPrice,
      taxRate: percentToRate(l.taxRate),
      poLineId: l.poLineId,
    })),
  });

  const saveDraft = (): void => {
    if (!po) return;
    localStorage.setItem(
      DRAFT_KEY(po.id),
      JSON.stringify({ invoiceNumber, invoiceDate, irn, ewaybill, lines }),
    );
    setError(null);
    setNotice('Draft saved on this device.');
  };

  const onSubmit = async (): Promise<void> => {
    if (!po) return;
    if (!canSubmit) {
      setError(
        isProforma
          ? 'Add the PI number, date and the proforma document before submitting.'
          : 'Add an invoice number, date and tax invoice before submitting.',
      );
      return;
    }
    setError(null);
    // The document has to reach storage before the invoice references it — the
    // API rejects a key it cannot find, so a failed upload stops the submission
    // rather than creating an invoice with a dead attachment link.
    setUploading(true);
    let s3Key: string;
    try {
      s3Key = await uploadInvoiceFile(taxFiles[0]!);
    } catch (e) {
      setUploading(false);
      setError((e as Error).message || 'Could not upload the document.');
      return;
    }
    setUploading(false);
    submit.mutate(buildPayload(s3Key), {
      onSuccess: () => {
        localStorage.removeItem(DRAFT_KEY(po.id));
        router.push('/vendor/invoices');
      },
      onError: (e) =>
        setError((e as Error).message || 'Submission failed. Please try again.'),
    });
  };

  // Step 1 — PO selection modal (no form until Continue).
  if (!po) {
    return (
      <PoSelectModal
        pos={pos}
        isLoading={isLoading}
        onCancel={backToList}
        onContinue={pickPo}
      />
    );
  }

  // Step 2 — invoice form.
  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={backToList}
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
      </button>
      <PageHeader title="Create invoice" />
      <div className="flex flex-col gap-5">
        {/* Section 1 — PO information */}
        <Section title="Purchase order">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
            <Field label="PO Number" value={po.number} mono />
            <Field label="Line items" value={String(po.lines.length)} mono />
            <Field label="Taxable value" value={inr(po.amounts.subtotal)} mono />
            <Field
              label={`Tax (${po.amounts.taxKind})`}
              value={inr(po.amounts.taxAmount)}
              mono
            />
            <Field label="Total PO amount" value={inr(po.amounts.total)} mono strong />
          </dl>
        </Section>

        {/* Section 2 — invoice details */}
        <Section title="Invoice details">
          {/* A proforma collects an advance before supply. Its tax invoice is
              uploaded onto the same invoice later, from My invoices. */}
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-[12px] font-medium text-text">
              What are you submitting?
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['TAX_INVOICE', 'Tax invoice'],
                  ['PROFORMA', 'Proforma invoice (PI)'],
                ] as const
              ).map(([kind, text]) => (
                <label
                  key={kind}
                  className={
                    'flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 text-[13px] ' +
                    (documentKind === kind
                      ? 'border-accent bg-accent-wash text-ink'
                      : 'border-line text-text')
                  }
                >
                  <input
                    type="radio"
                    name="documentKind"
                    value={kind}
                    checked={documentKind === kind}
                    onChange={() => setDocumentKind(kind)}
                  />
                  {text}
                </label>
              ))}
            </div>
            {/* {isProforma && (
              <p className="mt-2 text-[12px] text-muted">
                The buyer can pay an advance against the proforma. The balance is paid
                once you upload the tax invoice for it from My invoices.
              </p>
            )} */}
          </fieldset>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Labeled label={isProforma ? 'PI number' : 'Invoice number'} required>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. PES/2026/0042"
              />
            </Labeled>
            <Labeled label={isProforma ? 'PI date' : 'Invoice date'} required>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </Labeled>
            <Labeled label="IRN number">
              <Input
                value={irn}
                onChange={(e) => setIrn(e.target.value)}
                placeholder="Invoice Reference Number"
              />
            </Labeled>
            <Labeled label="e-Way bill number">
              <Input
                value={ewaybill}
                onChange={(e) => setEwaybill(e.target.value)}
                placeholder="Optional"
              />
            </Labeled>
          </div>
        </Section>

        {/* Section 3 — line items */}
        <Section title="Line items">
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-[13px]">
              <thead className="border-line border-b text-left text-[12px] text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="w-24 px-3 py-2 font-medium">Quantity</th>
                  <th className="w-28 px-3 py-2 font-medium">Rate</th>
                  <th className="w-24 px-3 py-2 font-medium">GST %</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Taxable</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Tax</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.poLineId ?? l.lineNo} className="border-t border-line">
                    <td className="px-3 py-2">
                      <div className="text-text">{l.itemDesc}</div>
                      <div className="text-[11px] text-faint">{l.uom}</div>
                      {/* The supplier cannot see the buyer's goods receipts, so
                          without this the seeded quantity looks arbitrary. */}
                      <div className="mt-1 text-[11px] text-faint">{basisLabel(l)}</div>
                      {overBillable(l) && (
                        <div className="mt-1 text-[11px] text-warn">
                          Over the {l.qtyBillable} still billable — this will be held for
                          buyer review.
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label={`Quantity for ${l.itemDesc}`}
                        value={l.qty}
                        onChange={(e) => updateLine(i, { qty: e.target.value })}
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label={`Rate for ${l.itemDesc}`}
                        value={l.unitPrice}
                        onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        aria-label={`GST percent for ${l.itemDesc}`}
                        value={l.taxRate}
                        onChange={(e) => updateLine(i, { taxRate: e.target.value })}
                        className="h-8"
                      />
                    </td>
                    <td className="font-numeric px-3 py-2 text-right text-text">
                      {inr(amountOf(l))}
                    </td>
                    <td className="font-numeric px-3 py-2 text-right text-text">
                      {inr(taxOf(l))}
                    </td>
                    <td className="font-numeric px-3 py-2 text-right text-ink">
                      {inr(Money.of(amountOf(l)).add(taxOf(l)).toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-canvas">
                <tr className="border-t border-line">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-right text-[12px] font-medium text-muted"
                  >
                    Taxable value
                  </td>
                  <td colSpan={2} className="font-numeric px-3 py-2 text-right text-text">
                    {inr(invoiceSubtotal.toString())}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-right text-[12px] font-medium text-muted"
                  >
                    Tax ({po.amounts.taxKind})
                  </td>
                  <td colSpan={2} className="font-numeric px-3 py-2 text-right text-text">
                    {inr(invoiceTax.toString())}
                  </td>
                </tr>
                <tr className="border-t border-line">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-right text-[12px] font-medium text-muted"
                  >
                    Invoice total
                  </td>
                  <td
                    colSpan={2}
                    className="font-numeric px-3 py-2 text-right font-semibold text-ink"
                  >
                    {inr(invoiceTotal.toString())}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>

        {/* Section 4 — documents */}
        <Section title="Documents">
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-text">
                {isProforma ? 'Proforma invoice' : 'Tax invoice'}{' '}
                <span className="text-danger">*</span>
              </p>
              <FileDrop
                label={isProforma ? 'Proforma invoice' : 'Tax invoice'}
                files={taxFiles}
                onChange={setTaxFiles}
              />
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-text">
                Supporting documents
              </p>
              <FileDrop
                label="Supporting documents"
                accept="*"
                multiple
                files={supportFiles}
                onChange={setSupportFiles}
              />
            </div>
          </div>
        </Section>

        {(error || notice) && (
          <div className={
              'rounded-sm px-3 py-2 text-[12px] ' +
              (error ? 'bg-danger-wash text-danger' : 'bg-accent-wash text-accent-2')
            }
          >
            {error ?? notice}
          </div>
        )}
      </div>

      {/* Section 5 — sticky actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-2 px-6 py-3">
          <Button variant="ghost" size="sm" onClick={backToList}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={saveDraft}>
            Save draft
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit || uploading || submit.isPending}
            onClick={() => void onSubmit()}
          >
            {uploading
              ? 'Uploading…'
              : submit.isPending
                ? 'Submitting…'
                : isProforma
                  ? 'Submit proforma'
                  : 'Submit invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-3 text-[14px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd
        className={
          (mono ? 'font-numeric ' : '') +
          (strong ? 'font-semibold text-ink' : 'text-text') +
          'mt-0.5 text-[13px]'
        }
      >
        {value}
      </dd>
    </div>
  );
}

function Labeled({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-text">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
