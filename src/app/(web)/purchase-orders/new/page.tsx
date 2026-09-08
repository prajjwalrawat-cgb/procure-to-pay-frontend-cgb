'use client';

import { Button, PageHeader } from '@/components/ui';
import type {
  PaymentTermKind,
  PoCreateInput,
  PoSpotBuyLineInput,
  VendorRef,
} from '@/lib/shared';
import { ArrowLeft, FileText, Paperclip, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { CustomFieldInputs } from '@/components/custom-fields';
import { DuplicatePoDialog } from '@/components/purchase-orders/duplicate-po-dialog';
import type { DraftTerm } from '@/components/purchase-orders/po-terms-editor';
import {
  PoTermsEditor,
  seedLibraryTerms,
  toTermInputs,
} from '@/components/purchase-orders/po-terms-editor';
import type { CustomFieldValues } from '@/lib/shared';
import { useClauseLibrary } from '@/lib/api/contracts';
import { saveCustomFieldValues } from '@/lib/api/settings';
import {
  useCreatePurchaseOrder,
  useSetPoTerms,
  useUploadPoAttachment,
} from '@/lib/api/purchase-orders';
import { useCostCenters, usePlants, useVendors } from '@/lib/api/refs';
import type { DuplicatePoMatch } from '@/lib/duplicate-po';
import { duplicatePosFromError } from '@/lib/duplicate-po';
import { inr } from '@/lib/format';
import { percentToRate } from '@/lib/rate';
import { INCOTERM_OPTIONS, PAYMENT_TERM_OPTIONS } from '@/lib/refs';
import { useToastStore } from '@/store/toast-store';

/**
 * Spot buy — a purchase order raised with no requisition behind it.
 *
 * The case this exists for: procurement already holds a written quote from a
 * registered vendor, and putting a PR through approval only to convert it
 * straight back into that same order is ceremony. The quote is uploaded here
 * instead, so the approver still has the evidence the price rests on.
 *
 * There is no value ceiling — the approval matrix gates by amount exactly as it
 * does for a PR-based PO.
 *
 * Rates are held as percentages in the form and converted to the fractions the
 * API expects on submit (see lib/rate.ts).
 */
const STEPS = ['Vendor & terms', 'Lines', 'Quote', 'Conditions', 'Review'];

interface DraftLine {
  key: string;
  itemDesc: string;
  hsnCode: string;
  uom: string;
  qtyOrdered: string;
  unitPrice: string;
  discountPct: string;
  taxRate: string;
}

let lineSeq = 0;
function blankLine(): DraftLine {
  lineSeq += 1;
  return {
    key: `l${lineSeq}`,
    itemDesc: '',
    hsnCode: '',
    uom: 'NOS',
    qtyOrdered: '1',
    unitPrice: '0',
    discountPct: '0',
    taxRate: '18',
  };
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function lineTotal(l: DraftLine): number {
  const base = num(l.qtyOrdered) * num(l.unitPrice);
  return base * (1 - num(l.discountPct) / 100) * (1 + num(l.taxRate) / 100);
}

const inputCls =
  'border-line bg-panel text-text placeholder:text-faint focus:border-accent w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none';

export default function NewSpotBuyPage(): React.JSX.Element {
  const router = useRouter();
  const toast = useToastStore((s) => s.push);

  const [step, setStep] = useState(0);
  const [vendorId, setVendorId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('DDP');
  const [paymentKind, setPaymentKind] = useState('NET_45');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [deliveryLine1, setDeliveryLine1] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [quote, setQuote] = useState<File | null>(null);
  const [quoteUrl, setQuoteUrl] = useState<string | null>(null);
  const [quoteNote, setQuoteNote] = useState('');
  const [terms, setTerms] = useState<DraftTerm[] | null>(null);
  const [special, setSpecial] = useState<DraftTerm[]>([]);
  const [saving, setSaving] = useState(false);
  // Admin-defined fields (Settings → Custom fields). Empty when the tenant has
  // defined none, in which case the section renders nothing.
  const [customFields, setCustomFields] = useState<CustomFieldValues>({});
  const [billToPlantId, setBillToPlantId] = useState<string>('');
  // Orders the server matched this one against; non-null opens the confirm step.
  const [duplicates, setDuplicates] = useState<DuplicatePoMatch | null>(null);

  // Object URLs leak until revoked, so the lifetime is tied to the chosen file.
  useEffect(() => {
    if (!quote) {
      setQuoteUrl(null);
      return;
    }
    const url = URL.createObjectURL(quote);
    setQuoteUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [quote]);

  const vendors = useVendors().data?.items ?? [];
  const costCenters = useCostCenters().data?.items ?? [];
  // Branches = GST registrations; the tenant default sorts first. Memoised so
  // the default-selection effect below does not re-run on every render.
  const plantData = usePlants().data;
  const plants = useMemo(() => plantData?.items ?? [], [plantData]);
  const library = useClauseLibrary();
  const createPo = useCreatePurchaseOrder();

  // Default to the tenant's default registration once the branch list lands —
  // /plants sorts it first.
  useEffect(() => {
    if (!billToPlantId && plants.length > 0) setBillToPlantId(plants[0]!.id);
  }, [billToPlantId, plants]);

  // Both take the PO id in the payload — it only exists after `createPo` below.
  const uploadQuote = useUploadPoAttachment();
  const setPoTerms = useSetPoTerms();

  // Seed the condition list from the library once it lands, pre-ticking whatever
  // legal marked as default. Kept in state so the user can untick freely.
  const libraryTerms: DraftTerm[] = terms ?? seedLibraryTerms(library.data);

  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const chosen = toTermInputs(libraryTerms, special);

  const step0Valid = vendorId && costCenterId && expectedDeliveryDate;
  const step1Valid =
    lines.length > 0 &&
    lines.every((l) => l.itemDesc.trim().length > 0 && num(l.qtyOrdered) > 0);
  const canAdvance = step === 0 ? step0Valid : step === 1 ? step1Valid : true;

  const updateLine = (key: string, patch: Partial<DraftLine>): void =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const buildBody = (): PoCreateInput => {
    const term = PAYMENT_TERM_OPTIONS.find((t) => t.value === paymentKind);
    return {
      kind: 'SPOT_BUY',
      vendorId,
      costCenterId,
      billToPlantId: billToPlantId || null,
      deliveryTerms: deliveryTerms as PoCreateInput['deliveryTerms'],
      paymentTerms: {
        kind: paymentKind as PaymentTermKind,
        days: term?.days ?? null,
        // Captured with the order so the PO prints the wording that was chosen,
        // even if the catalogue is reworded later.
        label: term?.label ?? null,
      },
      expectedDeliveryDate: new Date(
        `${expectedDeliveryDate}T00:00:00.000Z`,
      ).toISOString(),
      deliveryAddress: deliveryLine1.trim() ? { line1: deliveryLine1.trim() } : null,
      lines: lines.map((l): PoSpotBuyLineInput => ({
        itemId: null,
        itemDesc: l.itemDesc.trim(),
        hsnCode: l.hsnCode.trim() || null,
        uom: l.uom,
        qtyOrdered: l.qtyOrdered,
        unitPrice: l.unitPrice,
        discountPct: percentToRate(l.discountPct),
        taxRate: percentToRate(l.taxRate),
        glAccount: null,
      })),
    };
  };

  /**
   * The PO has to exist before its quote or its terms can be attached, so this
   * is three calls in sequence. The order matters: if the quote upload fails the
   * draft still exists and the user is taken to it rather than losing the whole
   * form, with a toast saying what is missing.
   *
   * `confirmDuplicate` is the buyer's answer to the duplicate warning below —
   * false on the first attempt, true on the retry once they have seen what the
   * server matched. Nothing else about the body changes, so the retry re-runs
   * this whole sequence rather than resuming a half-created order.
   */
  const submit = async (confirmDuplicate: boolean): Promise<void> => {
    setSaving(true);
    try {
      const { id } = await createPo.mutateAsync({ ...buildBody(), confirmDuplicate });

      if (quote) {
        try {
          await uploadQuote.mutateAsync({
            poId: id,
            file: quote,
            docType: 'QUOTE',
            note: quoteNote.trim() || undefined,
          });
        } catch {
          toast('PO created, but the quote failed to upload — attach it below.', 'error');
        }
      }

      try {
        await setPoTerms.mutateAsync({ poId: id, terms: chosen });
      } catch {
        toast('PO created, but the conditions failed to save — set them below.', 'error');
      }

      await saveCustomFieldValues('PURCHASE_ORDER', id, customFields);

      toast('Spot-buy PO drafted', 'success');
      router.push(`/purchase-orders/${id}`);
    } catch (e) {
      // A duplicate match is a question for the buyer, not a failure — the form
      // is left exactly as it is and the dialog asks it.
      const matched = duplicatePosFromError(e);
      if (matched) {
        setDuplicates(matched);
        setSaving(false);
        return;
      }
      toast(e instanceof Error ? e.message : 'Could not create the PO', 'error');
      setSaving(false);
    }
  };

  const onSubmit = (): Promise<void> => submit(false);

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <Link
        href="/purchase-orders"
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to purchase orders
      </Link>
      <PageHeader
        title="New purchase order"
        description="Raised directly against a vendor quote — no requisition required. It still goes through the normal PO approval before it can be issued."
      />

      <ol className="mb-5 flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={
                'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ' +
                (i === step
                  ? 'bg-ink text-white'
                  : i < step
                    ? 'bg-accent-wash text-accent-2'
                    : 'bg-canvas text-faint')
              }
            >
              {i + 1}
            </span>
            <span
              className={
                'text-[13px] ' + (i === step ? 'font-medium text-ink' : 'text-muted')
              }
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="text-faint">·</span>}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-line bg-panel p-4">
        {step === 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            <Labelled label="Vendor" required>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className={inputCls}
              >
                <option value="">Select a registered vendor…</option>
                {vendors.map((v: VendorRef) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.isMsme ? ' (MSME)' : ''}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Cost centre" required>
              <select
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
                className={inputCls}
              >
                <option value="">Select…</option>
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </Labelled>
            {/* Only worth asking when the tenant holds more than one
                registration; with one branch there is nothing to choose. */}
            {plants.length > 1 && (
              <Labelled label="Bill to (GST registration)" required>
                <select
                  value={billToPlantId}
                  onChange={(e) => setBillToPlantId(e.target.value)}
                  className={inputCls}
                >
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.gstin ? ` · ${p.gstin}` : ''}
                      {p.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-faint">
                  Decides the GSTIN on the PO and the place of supply — CGST+SGST vs IGST
                  — even when the goods ship elsewhere.
                </p>
              </Labelled>
            )}
            <Labelled label="Expected delivery" required>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className={inputCls}
              />
            </Labelled>
            <Labelled label="Incoterm">
              <select
                value={deliveryTerms}
                onChange={(e) => setDeliveryTerms(e.target.value)}
                className={inputCls}
              >
                {INCOTERM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Payment terms">
              <select
                value={paymentKind}
                onChange={(e) => setPaymentKind(e.target.value)}
                className={inputCls}
              >
                {PAYMENT_TERM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Labelled>
            <Labelled label="Delivery address">
              <input
                value={deliveryLine1}
                onChange={(e) => setDeliveryLine1(e.target.value)}
                placeholder="Plant / site address"
                className={inputCls}
              />
            </Labelled>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            {lines.map((l, i) => (
              <div key={l.key} className="rounded-lg border border-line bg-canvas/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                    Line {i + 1}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove line"
                      onClick={() =>
                        setLines((prev) => prev.filter((x) => x.key !== l.key))
                      }
                      className="text-muted hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <input
                  value={l.itemDesc}
                  onChange={(e) => updateLine(l.key, { itemDesc: e.target.value })}
                  placeholder="Description as quoted"
                  className={inputCls}
                />
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
                  <Small label="Qty">
                    <input
                      value={l.qtyOrdered}
                      inputMode="decimal"
                      onChange={(e) => updateLine(l.key, { qtyOrdered: e.target.value })}
                      className={inputCls}
                    />
                  </Small>
                  <Small label="UoM">
                    <input
                      value={l.uom}
                      onChange={(e) => updateLine(l.key, { uom: e.target.value })}
                      className={inputCls}
                    />
                  </Small>
                  <Small label="Unit price">
                    <input
                      value={l.unitPrice}
                      inputMode="decimal"
                      onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                      className={inputCls}
                    />
                  </Small>
                  <Small label="Disc %">
                    <input
                      value={l.discountPct}
                      inputMode="decimal"
                      onChange={(e) => updateLine(l.key, { discountPct: e.target.value })}
                      className={inputCls}
                    />
                  </Small>
                  <Small label="Tax %">
                    <input
                      value={l.taxRate}
                      inputMode="decimal"
                      onChange={(e) => updateLine(l.key, { taxRate: e.target.value })}
                      className={inputCls}
                    />
                  </Small>
                  <Small label="HSN">
                    <input
                      value={l.hsnCode}
                      onChange={(e) => updateLine(l.key, { hsnCode: e.target.value })}
                      className={inputCls}
                    />
                  </Small>
                </div>
                <div className="font-numeric mt-2 text-right text-[13px] font-semibold text-ink">
                  {inr(lineTotal(l).toFixed(2))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setLines((prev) => [...prev, blankLine()])}
              >
                <Plus className="h-3.5 w-3.5" /> Add line
              </Button>
              <span className="font-numeric ml-auto text-[14px] font-semibold text-ink">
                PO total {inr(total.toFixed(2))}
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              Attach the vendor&rsquo;s written quote. With no requisition behind this
              order, it is the only evidence an approver has for the price — and it is
              never shown to the vendor portal.
            </p>
            {!quote ? (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line py-10 text-center hover:bg-canvas">
                <Paperclip className="h-6 w-6 text-faint" />
                <span className="text-[13px] font-medium text-text">
                  Choose the quote file
                </span>
                <span className="text-[11px] text-faint">PDF, image or spreadsheet</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setQuote(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <>
                {/* Preview the local file before it is ever uploaded — picking the
                    wrong quote is easy, and it only reaches the server on submit,
                    so this is the only chance to catch it. */}
                <div className="rounded-lg border border-line bg-canvas/40 p-3">
                  <div className="flex items-start gap-3">
                    {quoteUrl && quote.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={quoteUrl}
                        alt={quote.name}
                        className="h-20 w-20 rounded-md border border-line object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-md border border-line bg-panel">
                        <FileText className="h-7 w-7 text-faint" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink">
                        {quote.name}
                      </div>
                      <div className="font-numeric text-[11px] text-faint">
                        {fileSize(quote.size)} · {quote.type || 'unknown type'}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[12px]">
                        {quoteUrl && (
                          <a
                            href={quoteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-accent-2 underline"
                          >
                            Open to check
                          </a>
                        )}
                        <label className="cursor-pointer font-medium text-accent-2 underline">
                          Replace
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => setQuote(e.target.files?.[0] ?? null)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setQuote(null)}
                          className="text-muted hover:text-danger"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                  {quoteUrl && quote.type === 'application/pdf' && (
                    <object
                      data={quoteUrl}
                      type="application/pdf"
                      className="mt-3 h-80 w-full rounded-md border border-line"
                      aria-label={`Preview of ${quote.name}`}
                    >
                      <p className="p-3 text-[12px] text-muted">
                        This browser cannot preview PDFs inline — use{' '}
                        <a
                          href={quoteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          Open to check
                        </a>
                        .
                      </p>
                    </object>
                  )}
                </div>
                <input
                  value={quoteNote}
                  onChange={(e) => setQuoteNote(e.target.value)}
                  placeholder="Note (quote ref, date, who negotiated it…)"
                  className={inputCls}
                />
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            {/* Renders nothing unless the tenant has defined fields. */}
            <CustomFieldInputs
              entity="PURCHASE_ORDER"
              values={customFields}
              onChange={setCustomFields}
            />
            <PoTermsEditor
              libraryTerms={libraryTerms}
              special={special}
              onLibraryChange={setTerms}
              onSpecialChange={setSpecial}
            />
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3 text-[13px]">
            <Row
              label="Vendor"
              value={vendors.find((v) => v.id === vendorId)?.name ?? '—'}
            />
            <Row
              label="Cost centre"
              value={
                costCenters.find((c) => c.id === costCenterId)
                  ? `${costCenters.find((c) => c.id === costCenterId)?.code} · ${costCenters.find((c) => c.id === costCenterId)?.name}`
                  : '—'
              }
            />
            <Row label="Lines" value={String(lines.length)} />
            <Row label="PO total" value={inr(total.toFixed(2))} />
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-muted">Quote</span>
              <span className="flex items-center gap-2 font-medium text-ink">
                {quote ? (
                  <>
                    <span className="truncate">{quote.name}</span>
                    <span className="font-numeric text-faint">
                      {fileSize(quote.size)}
                    </span>
                    {quoteUrl && (
                      <a
                        href={quoteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-2 underline"
                      >
                        Open
                      </a>
                    )}
                  </>
                ) : (
                  'Not attached'
                )}
              </span>
            </div>
            <Row
              label="Conditions"
              value={`${chosen.length} (${chosen.filter((t) => !t.isFromLibrary).length} special)`}
            />
            {!quote && (
              <p className="text-[12px] text-warn">
                No quote attached. The approver will have nothing to check this price
                against — you can still add it on the PO afterwards.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="default"
          size="sm"
          disabled={step === 0 || saving}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            variant="accent"
            size="sm"
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
          >
            Next
          </Button>
        ) : (
          <Button variant="accent" size="sm" disabled={saving} onClick={onSubmit}>
            {saving ? 'Creating…' : 'Create draft PO'}
          </Button>
        )}
      </div>

      <DuplicatePoDialog
        match={duplicates}
        busy={saving}
        onCancel={() => setDuplicates(null)}
        onConfirm={() => {
          setDuplicates(null);
          void submit(true);
        }}
      />
    </div>
  );
}

function Labelled({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Small({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-faint">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-line pb-2">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
