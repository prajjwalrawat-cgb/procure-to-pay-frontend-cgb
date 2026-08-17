'use client';

import { Button, Input } from '@/components/ui';
import { Money, type VendorPoOption } from '@/lib/shared';
import { percentToRate, rateToPercent } from '@/lib/rate';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FileDrop } from '@/vendor/components/invoices/file-drop';
import { PoSelectModal } from '@/vendor/components/invoices/po-select-modal';
import { useOpenPos, useSubmitInvoice } from '@/vendor/lib/api/invoices';

interface LineDraft {
  lineNo: number;
  itemDesc: string;
  uom: string;
  qty: string;
  unitPrice: string;
  /** Held as a **percentage** ('5'), like the buyer forms; converted on submit. */
  taxRate: string;
  poLineId: string | null;
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
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [irn, setIrn] = useState('');
  const [ewaybill, setEwaybill] = useState('');
  const [taxFiles, setTaxFiles] = useState<File[]>([]);
  const [supportFiles, setSupportFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const backToList = (): void => router.push('/vendor/invoices');

  const pickPo = (selected: VendorPoOption): void => {
    const seeded: LineDraft[] = selected.lines.map((l) => ({
      lineNo: l.lineNo,
      itemDesc: l.itemDesc,
      uom: l.uom,
      qty: l.qtyOrdered,
      unitPrice: l.unitPrice,
      taxRate: rateToPercent(l.taxRate),
      poLineId: l.id,
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

  const buildPayload = () => ({
    poId: po!.id,
    vendorInvoiceRef: invoiceNumber.trim(),
    invoiceDate: new Date(`${invoiceDate}T00:00:00.000Z`).toISOString(),
    s3Key: `invoices/vendor/${po!.number}_${Date.now()}_${taxFiles[0]?.name ?? 'tax-invoice.pdf'}`,
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

  const onSubmit = (): void => {
    if (!po) return;
    if (!canSubmit) {
      setError('Add an invoice number, date and tax invoice before submitting.');
      return;
    }
    setError(null);
    submit.mutate(buildPayload(), {
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
    <div className="mx-auto max-w-4xl pb-24">
      <button
        type="button"
        onClick={backToList}
        className="text-muted mb-3 inline-flex items-center gap-1 text-[12px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to invoices
      </button>
      <h1 className="tracking-heading text-ink mb-5 text-[20px] font-semibold">
        Create invoice
      </h1>

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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Labeled label="Invoice number" required>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. PES/2026/0042"
              />
            </Labeled>
            <Labeled label="Invoice date" required>
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
          <div className="border-line overflow-hidden rounded-lg border">
            <table className="w-full text-[13px]">
              <thead className="bg-canvas text-faint text-left text-[11px] uppercase tracking-wide">
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
                  <tr key={l.poLineId ?? l.lineNo} className="border-line border-t">
                    <td className="px-3 py-2">
                      <div className="text-text">{l.itemDesc}</div>
                      <div className="text-faint text-[11px]">{l.uom}</div>
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
                    <td className="font-numeric text-text px-3 py-2 text-right">
                      {inr(amountOf(l))}
                    </td>
                    <td className="font-numeric text-text px-3 py-2 text-right">
                      {inr(taxOf(l))}
                    </td>
                    <td className="font-numeric text-ink px-3 py-2 text-right">
                      {inr(Money.of(amountOf(l)).add(taxOf(l)).toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-canvas">
                <tr className="border-line border-t">
                  <td
                    colSpan={5}
                    className="text-muted px-3 py-2 text-right text-[12px] font-medium"
                  >
                    Taxable value
                  </td>
                  <td colSpan={2} className="font-numeric text-text px-3 py-2 text-right">
                    {inr(invoiceSubtotal.toString())}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted px-3 py-2 text-right text-[12px] font-medium"
                  >
                    Tax ({po.amounts.taxKind})
                  </td>
                  <td colSpan={2} className="font-numeric text-text px-3 py-2 text-right">
                    {inr(invoiceTax.toString())}
                  </td>
                </tr>
                <tr className="border-line border-t">
                  <td
                    colSpan={5}
                    className="text-muted px-3 py-2 text-right text-[12px] font-medium"
                  >
                    Invoice total
                  </td>
                  <td
                    colSpan={2}
                    className="font-numeric text-ink px-3 py-2 text-right font-semibold"
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
              <p className="text-text mb-1.5 text-[12px] font-medium">
                Tax invoice <span className="text-danger">*</span>
              </p>
              <FileDrop label="Tax invoice" files={taxFiles} onChange={setTaxFiles} />
            </div>
            <div>
              <p className="text-text mb-1.5 text-[12px] font-medium">
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
          <div
            className={
              'rounded-sm px-3 py-2 text-[12px] ' +
              (error ? 'bg-danger-wash text-danger' : 'bg-accent-wash text-accent-2')
            }
          >
            {error ?? notice}
          </div>
        )}
      </div>

      {/* Section 5 — sticky actions */}
      <div className="border-line bg-panel/95 fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-2 px-6 py-3">
          <Button variant="ghost" size="sm" onClick={backToList}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={saveDraft}>
            Save draft
          </Button>
          <Button
            variant="accent"
            disabled={!canSubmit || submit.isPending}
            onClick={onSubmit}
          >
            {submit.isPending ? 'Submitting…' : 'Submit invoice'}
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
    <section className="border-line bg-panel rounded-lg border p-4">
      <h2 className="text-ink mb-3 text-[14px] font-semibold">{title}</h2>
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
      <dt className="text-faint text-[11px] uppercase tracking-wide">{label}</dt>
      <dd
        className={
          (mono ? 'font-numeric ' : '') +
          (strong ? 'text-ink font-semibold ' : 'text-text ') +
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
      <span className="text-text text-[12px] font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
