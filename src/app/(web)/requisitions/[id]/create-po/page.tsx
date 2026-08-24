'use client';

import { Button, PageHeader, Pill } from '@/components/ui';
import { ArrowLeft, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { PaymentTermKind, PoCreateInput, RequisitionLineView } from '@/lib/shared';

import type { DraftTerm } from '@/components/purchase-orders/po-terms-editor';
import {
  PoTermsEditor,
  seedLibraryTerms,
  toTermInputs,
} from '@/components/purchase-orders/po-terms-editor';
import { useClauseLibrary } from '@/lib/api/contracts';
import { useCreatePurchaseOrder, useSetPoTerms } from '@/lib/api/purchase-orders';
import { useVendors } from '@/lib/api/refs';
import { useRequisition } from '@/lib/api/requisitions';
import { inr } from '@/lib/format';
import { INCOTERM_OPTIONS, PAYMENT_TERM_OPTIONS } from '@/lib/refs';
import { useToastStore } from '@/store/toast-store';

interface PoCard {
  key: string;
  vendorId: string;
  deliveryTerms: string;
  paymentKind: string;
  expectedDeliveryDate: string;
  deliveryLine1: string;
  /** prLineId -> qty string */
  lines: Record<string, string>;
  /**
   * Null until the buyer touches the list — the clause library loads after the
   * card is created, so the seeded set is derived on render instead of frozen
   * at construction time.
   */
  terms: DraftTerm[] | null;
  special: DraftTerm[];
  termsOpen: boolean;
}

let cardSeq = 0;
function blankCard(defaultDate: string): PoCard {
  cardSeq += 1;
  return {
    key: `c${cardSeq}`,
    vendorId: '',
    deliveryTerms: 'DDP',
    paymentKind: 'NET_45',
    expectedDeliveryDate: defaultDate,
    deliveryLine1: '',
    lines: {},
    terms: null,
    special: [],
    termsOpen: false,
  };
}

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function CreatePoPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data, isLoading } = useRequisition(id);
  const { data: vendorData } = useVendors();
  const vendors = vendorData?.items ?? [];
  const createPo = useCreatePurchaseOrder();
  const setPoTerms = useSetPoTerms();
  const library = useClauseLibrary();

  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const [cards, setCards] = useState<PoCard[]>(() => [blankCard(defaultDate)]);
  const [saving, setSaving] = useState(false);

  if (isLoading || !data) {
    return <div className="p-6 text-[13px] text-muted">Loading requisition…</div>;
  }

  const prLines = data.lines;

  const allocatedFor = (prLineId: string): number =>
    cards.reduce((s, c) => s + num(c.lines[prLineId]), 0);

  const remainingFor = (line: RequisitionLineView): number =>
    num(line.qtyRemaining) - allocatedFor(line.id);

  const updateCard = (key: string, patch: Partial<PoCard>): void =>
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  /**
   * The library defaults stand in until the buyer edits the set, so a card
   * created before /clause-library resolved still shows the ticked clauses.
   */
  const termsFor = (card: PoCard): DraftTerm[] =>
    card.terms ?? seedLibraryTerms(library.data);

  const setLineQty = (key: string, prLineId: string, qty: string): void =>
    setCards((prev) =>
      prev.map((c) =>
        c.key === key ? { ...c, lines: { ...c.lines, [prLineId]: qty } } : c,
      ),
    );

  const cardTotal = (card: PoCard): number =>
    prLines.reduce((sum, l) => {
      const qty = num(card.lines[l.id]);
      if (qty <= 0) return sum;
      const base = qty * num(l.unitPrice);
      // PR line tax rates are fractions ('0.18'), not percentages.
      return sum + base * (1 + num(l.taxRate));
    }, 0);

  const validate = (): string | null => {
    for (const l of prLines) {
      if (allocatedFor(l.id) - num(l.qtyRemaining) > 1e-6) {
        return `Line "${l.itemDesc}" over-allocated beyond remaining qty`;
      }
    }
    const active = cards.filter((c) => Object.values(c.lines).some((q) => num(q) > 0));
    if (active.length === 0) return 'Allocate at least one line to a PO';
    for (const c of active) {
      if (!c.vendorId) return 'Every PO needs a vendor';
      if (!c.expectedDeliveryDate) return 'Every PO needs an expected delivery date';
    }
    return null;
  };

  const onSaveAll = async (): Promise<void> => {
    const err = validate();
    if (err) {
      toast(err, 'error');
      return;
    }
    setSaving(true);
    const active = cards.filter((c) => Object.values(c.lines).some((q) => num(q) > 0));
    const createdIds: string[] = [];
    try {
      for (const card of active) {
        const term = PAYMENT_TERM_OPTIONS.find((t) => t.value === card.paymentKind);
        const body: PoCreateInput = {
          kind: 'FROM_PR',
          requisitionId: id,
          vendorId: card.vendorId,
          deliveryTerms: card.deliveryTerms as PoCreateInput['deliveryTerms'],
          paymentTerms: {
            kind: card.paymentKind as PaymentTermKind,
            days: term?.days ?? null,
            // Captured with the order so the PO prints the wording chosen here.
            label: term?.label ?? null,
          },
          expectedDeliveryDate: new Date(
            `${card.expectedDeliveryDate}T00:00:00.000Z`,
          ).toISOString(),
          deliveryAddress: card.deliveryLine1 ? { line1: card.deliveryLine1 } : null,
          lines: prLines
            .filter((l) => num(card.lines[l.id]) > 0)
            .map((l) => ({ prLineId: l.id, qtyOrdered: card.lines[l.id] })),
        };
        const res = await createPo.mutateAsync(body);
        createdIds.push(res.id);

        // The PO has to exist before its terms can hang off it. A failure here
        // leaves a usable draft — the clauses can still be set on the PO — so it
        // warns rather than aborting the rest of the split-award.
        try {
          await setPoTerms.mutateAsync({
            poId: res.id,
            terms: toTermInputs(termsFor(card), card.special),
          });
        } catch {
          toast(
            'PO created, but its terms & conditions failed to save — set them on the PO.',
            'error',
          );
        }
      }
      toast(`Created ${createdIds.length} PO draft(s)`, 'success');
      const [first, ...rest] = createdIds;
      const q = rest.length > 0 ? `?batch=${rest.join(',')}` : '';
      router.push(`/purchase-orders/${first}${q}`);
    } catch (e) {
      toast((e as Error).message, 'error');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <Link
        href={`/requisitions/${id}`}
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to requisition
      </Link>
      <PageHeader
        title="Create purchase orders"
        description={
          <>
            Split-award <span className="font-numeric">{data.number}</span> · {data.title}
          </>
        }
        actions={
          <>
            <Button variant="accent" size="sm" disabled={saving} onClick={onSaveAll}>
              Save all as drafts
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* Left — PR lines with balance */}
        <aside>
          <h2 className="mb-2 text-[14px] font-semibold text-ink">Requisition lines</h2>
          <div className="flex flex-col gap-2">
            {prLines.map((l) => {
              const remaining = remainingFor(l);
              return (
                <div
                  key={l.id}
                  className="rounded-lg border border-line bg-panel p-3 text-[12px]"
                >
                  <div className="font-medium text-text">{l.itemDesc}</div>
                  <div className="font-numeric text-[10px] text-faint">
                    {l.skuCode ?? 'Non-catalogued'} · {inr(l.unitPrice, 0)} / {l.uom}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted">
                      Remaining {num(l.qtyRemaining)} {l.uom}
                    </span>
                    <Pill
                      variant={
                        remaining < -1e-6
                          ? 'danger'
                          : remaining < 1e-6
                            ? 'success'
                            : 'warn'
                      }
                    >
                      {remaining < -1e-6
                        ? `over by ${Math.abs(remaining)}`
                        : `${remaining} to allocate`}
                    </Pill>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right — PO builder cards */}
        <div className="flex flex-col gap-4">
          {cards.map((card, ci) => (
            <div key={card.key} className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-ink">
                  PO draft {ci + 1}
                </span>
                {cards.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove PO"
                    onClick={() =>
                      setCards((prev) => prev.filter((c) => c.key !== card.key))
                    }
                    className="text-muted hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Vendor">
                  <select
                    value={card.vendorId}
                    onChange={(e) => updateCard(card.key, { vendorId: e.target.value })}
                    className={inputCls}
                  >
                    <option value="">Select vendor…</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id} disabled={!v.bankVerified}>
                        {v.name}
                        {v.isMsme ? ' (MSME)' : ''}
                        {v.bankVerified ? '' : ' — bank unverified'}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Expected delivery">
                  <input
                    type="date"
                    value={card.expectedDeliveryDate}
                    onChange={(e) =>
                      updateCard(card.key, { expectedDeliveryDate: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label="Delivery terms">
                  <select
                    value={card.deliveryTerms}
                    onChange={(e) =>
                      updateCard(card.key, { deliveryTerms: e.target.value })
                    }
                    className={inputCls}
                  >
                    {INCOTERM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Payment terms">
                  <select
                    value={card.paymentKind}
                    onChange={(e) =>
                      updateCard(card.key, { paymentKind: e.target.value })
                    }
                    className={inputCls}
                  >
                    {PAYMENT_TERM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Delivery address (line 1)">
                  <input
                    value={card.deliveryLine1}
                    onChange={(e) =>
                      updateCard(card.key, { deliveryLine1: e.target.value })
                    }
                    placeholder="Optional"
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Line allocation */}
              <div className="mt-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-faint">
                  Allocate lines
                </div>
                <div className="flex flex-col gap-1.5">
                  {prLines.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 text-[12px]">
                      <span className="flex-1 truncate text-text">{l.itemDesc}</span>
                      <span className="font-numeric text-faint">
                        rem {remainingFor(l)}
                      </span>
                      <input
                        value={card.lines[l.id] ?? ''}
                        onChange={(e) => setLineQty(card.key, l.id, e.target.value)}
                        inputMode="decimal"
                        placeholder="0"
                        className="font-numeric w-20 rounded-sm border border-line bg-canvas px-2 py-1 text-right text-[12px] outline-none"
                      />
                      <span className="w-10 text-faint">{l.uom}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terms & conditions — same clause set as a spot-buy PO, so the
                  printed PDF reads identically whichever route raised it. */}
              <div className="mt-3 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => updateCard(card.key, { termsOpen: !card.termsOpen })}
                  className="flex w-full items-center justify-between text-[12px] font-medium text-text"
                >
                  <span className="flex items-center gap-1">
                    {card.termsOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    Terms &amp; conditions
                  </span>
                  <span className="font-numeric text-faint">
                    {termsFor(card).filter((t) => t.selected).length +
                      card.special.filter((t) => t.title.trim()).length}{' '}
                    selected
                  </span>
                </button>
                {card.termsOpen && (
                  <div className="mt-2">
                    <PoTermsEditor
                      libraryTerms={termsFor(card)}
                      special={card.special}
                      onLibraryChange={(next) => updateCard(card.key, { terms: next })}
                      onSpecialChange={(next) => updateCard(card.key, { special: next })}
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
                <span className="text-[12px] text-muted">PO total</span>
                <span className="font-numeric text-[14px] font-semibold text-ink">
                  {inr(cardTotal(card).toFixed(2))}
                </span>
              </div>
            </div>
          ))}

          <Button
            variant="default"
            size="sm"
            className="self-start"
            onClick={() => setCards((prev) => [...prev, blankCard(defaultDate)])}
          >
            <Plus className="h-3.5 w-3.5" /> Add another PO
          </Button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'border-line bg-panel focus-visible:ring-accent w-full rounded-sm border px-3 py-2 text-[13px] outline-none focus-visible:ring-2';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
