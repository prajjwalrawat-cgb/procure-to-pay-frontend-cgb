'use client';

import { Button, Input } from '@/components/ui';
import { useState } from 'react';
import type { TaxInvoiceInput } from '@/lib/shared';

import { inr } from '@/lib/format';
import { percentToRate, rateToPercent } from '@/lib/rate';
import { FileDrop } from '@/vendor/components/invoices/file-drop';

/** A proforma line, as the form is seeded from it. `taxRate` is a fraction. */
export interface SeedLine {
  lineNo: number;
  poLineId: string | null;
  itemDesc: string;
  uom: string;
  qty: string;
  unitPrice: string;
  taxRate: string;
}

interface LineDraft extends SeedLine {
  /** Held as a percentage ('18') while editing; converted on submit. */
  taxPct: string;
}

const today = (): string => new Date().toISOString().slice(0, 10);
const lineBase = (l: LineDraft): number => Number(l.qty || 0) * Number(l.unitPrice || 0);
const lineTax = (l: LineDraft): number => (lineBase(l) * Number(l.taxPct || 0)) / 100;

/**
 * The tax invoice that replaces a proforma: the document, its number and date,
 * and its lines — seeded from the PI, which the tax invoice normally repeats.
 *
 * The person uploading confirms the lines rather than OCR reading them, the
 * same as a portal submission: OCR then checks the page against what was
 * entered (printed total, number, date, supplier) and raises what disagrees.
 */
export function TaxInvoiceForm({
  proformaRef,
  proformaTotal,
  seedLines,
  pending,
  onCancel,
  onSubmit,
}: {
  proformaRef: string;
  proformaTotal: string;
  seedLines: SeedLine[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (file: File, body: Omit<TaxInvoiceInput, 's3Key'>) => void;
}): React.JSX.Element {
  const [files, setFiles] = useState<File[]>([]);
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(today());
  const [irn, setIrn] = useState('');
  const [ewaybill, setEwaybill] = useState('');
  const [lines, setLines] = useState<LineDraft[]>(() =>
    seedLines.map((l) => ({ ...l, taxPct: rateToPercent(l.taxRate) })),
  );
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<LineDraft>): void =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const total = lines.reduce((sum, l) => sum + lineBase(l) + lineTax(l), 0);
  const delta = total - Number(proformaTotal);
  const ready =
    files.length > 0 &&
    number.trim().length > 0 &&
    date.length > 0 &&
    lines.some((l) => Number(l.qty) > 0);

  const submit = (): void => {
    if (!ready) {
      setError('Attach the tax invoice and enter its number and date.');
      return;
    }
    setError(null);
    onSubmit(files[0]!, {
      vendorInvoiceRef: number.trim(),
      invoiceDate: new Date(`${date}T00:00:00.000Z`).toISOString(),
      irn: irn.trim() || null,
      ewaybillNo: ewaybill.trim() || null,
      lines: lines
        .filter((l) => Number(l.qty) > 0)
        .map((l) => ({
          lineNo: l.lineNo,
          poLineId: l.poLineId,
          itemDesc: l.itemDesc,
          uom: l.uom,
          qty: l.qty,
          unitPrice: l.unitPrice,
          taxRate: percentToRate(l.taxPct),
        })),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-caption font-medium text-text">
          Tax invoice <span className="text-danger">*</span>
        </p>
        <FileDrop label="Tax invoice" files={files} onChange={setFiles} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Tax invoice number" required>
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={`Not the PI number (${proformaRef})`}
          />
        </Labeled>
        <Labeled label="Invoice date" required>
          <Input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Labeled>
        <Labeled label="IRN">
          <Input value={irn} onChange={(e) => setIrn(e.target.value)} />
        </Labeled>
        <Labeled label="e-Way bill number">
          <Input value={ewaybill} onChange={(e) => setEwaybill(e.target.value)} />
        </Labeled>
      </div>

      <div>
        <p className="mb-1.5 text-caption font-medium text-text">
          Lines on the tax invoice
        </p>
        <p className="mb-2 text-micro text-muted">
          Copied from the proforma. Change anything the tax invoice bills differently.
        </p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-caption">
            <thead className="bg-canvas text-left text-micro uppercase tracking-wide text-faint">
              <tr>
                <th className="px-2.5 py-2 font-medium">Item</th>
                <th className="w-20 px-2.5 py-2 font-medium">Qty</th>
                <th className="w-24 px-2.5 py-2 font-medium">Rate</th>
                <th className="w-16 px-2.5 py-2 font-medium">GST %</th>
                <th className="w-24 px-2.5 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.poLineId ?? l.lineNo} className="border-t border-line">
                  <td className="px-2.5 py-1.5">
                    <div className="text-text">{l.itemDesc}</div>
                    <div className="text-micro text-faint">{l.uom}</div>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <Input
                      aria-label={`Quantity for ${l.itemDesc}`}
                      value={l.qty}
                      inputMode="decimal"
                      onChange={(e) => update(i, { qty: e.target.value })}
                      className="font-numeric h-8"
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <Input
                      aria-label={`Rate for ${l.itemDesc}`}
                      value={l.unitPrice}
                      inputMode="decimal"
                      onChange={(e) => update(i, { unitPrice: e.target.value })}
                      className="font-numeric h-8"
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <Input
                      aria-label={`GST percent for ${l.itemDesc}`}
                      value={l.taxPct}
                      inputMode="decimal"
                      onChange={(e) => update(i, { taxPct: e.target.value })}
                      className="font-numeric h-8"
                    />
                  </td>
                  <td className="font-numeric px-2.5 py-1.5 text-right text-ink">
                    {inr(lineBase(l) + lineTax(l))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-2 flex flex-col gap-0.5 rounded-sm bg-canvas px-3 py-2 text-caption">
          <div className="flex justify-between">
            <dt className="text-muted">Proforma total</dt>
            <dd className="font-numeric text-text">{inr(proformaTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Tax invoice total</dt>
            <dd className="font-numeric font-semibold text-ink">{inr(total)}</dd>
          </div>
          {Math.abs(delta) > 1 && (
            <p className="mt-1 text-micro text-warn">
              {delta > 0
                ? `${inr(delta)} more than the proforma — this will go back to the approver.`
                : `${inr(-delta)} less than the proforma.`}
            </p>
          )}
        </dl>
      </div>

      {error && (
        <div className="rounded-sm bg-danger-wash px-3 py-2 text-caption text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button variant="accent" size="sm" onClick={submit} disabled={!ready || pending}>
          {pending ? 'Uploading…' : 'Upload tax invoice'}
        </Button>
      </div>
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
      <span className="text-caption font-medium text-text">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
