'use client';

import {
  Button,
  PageHeader,
  Skeleton,
  StepIndicator,
  controlClass,
} from '@/components/ui';

import type { ClauseInput, ContractCreateInput, RateCardInput } from '@/lib/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useClauseLibrary, useCreateContract } from '@/lib/api/contracts';
import { useVendorList } from '@/lib/api/vendors';
import { humanise } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const STEPS = ['Basics', 'Rate card', 'Clauses', 'Escalation', 'Review'];
const TYPES = ['RATE_CONTRACT', 'FRAMEWORK_AGREEMENT', 'BLANKET_PO', 'SERVICE_AGREEMENT'];

function isoDay(d: string): string {
  return new Date(`${d}T00:00:00Z`).toISOString();
}

export default function NewContractPage(): React.JSX.Element {
  const router = useRouter();
  const push = useToastStore((s) => s.push);
  const create = useCreateContract();
  const { data: vendors } = useVendorList('active');
  const { data: library } = useClauseLibrary();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [contractType, setContractType] = useState('RATE_CONTRACT');
  const [vendorId, setVendorId] = useState('');
  const [category, setCategory] = useState('');
  const [validityStart, setValidityStart] = useState('2026-04-01');
  const [validityEnd, setValidityEnd] = useState('2028-03-31');
  const [totalValue, setTotalValue] = useState('0');
  const [paymentKind, setPaymentKind] = useState('NET_30');
  const [minQty, setMinQty] = useState('');
  const [commitmentUom, setCommitmentUom] = useState('');

  const [rateCards, setRateCards] = useState<RateCardInput[]>([
    {
      itemDesc: '',
      uom: '',
      rateYear: 1,
      unitRate: '',
      taxRate: '0.05',
      effectiveFrom: '',
      effectiveTo: '',
    },
  ]);
  const [selectedClauses, setSelectedClauses] = useState<Set<string>>(new Set());

  const [escType, setEscType] = useState('');
  const [escIndexRef, setEscIndexRef] = useState('');
  const [escBase, setEscBase] = useState('');
  const [escFreq, setEscFreq] = useState('QUARTERLY');
  const [escCap, setEscCap] = useState('');

  const addRateCard = (): void =>
    setRateCards((r) => [
      ...r,
      {
        itemDesc: '',
        uom: '',
        rateYear: 1,
        unitRate: '',
        taxRate: '0.05',
        effectiveFrom: '',
        effectiveTo: '',
      },
    ]);
  const setRc = (i: number, patch: Partial<RateCardInput>): void =>
    setRateCards((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const submit = async (): Promise<void> => {
    const clauses: ClauseInput[] = (library ?? [])
      .filter((l) => selectedClauses.has(l.id))
      .map((l, i) => ({
        clauseType: l.clauseType,
        title: l.title,
        contentText: l.contentText,
        isFromLibrary: true,
        libraryClauseId: l.id,
        orderNo: i,
        isMandatory: ['PAYMENT_TERMS', 'DELIVERY_SLA', 'TERMINATION'].includes(
          l.clauseType,
        ),
      }));
    const body: ContractCreateInput = {
      title,
      contractType: contractType as ContractCreateInput['contractType'],
      vendorId,
      category,
      validityStart: isoDay(validityStart),
      validityEnd: isoDay(validityEnd),
      autoRenew: false,
      renewalNoticeDays: 90,
      currency: 'INR',
      totalValueEstimate: totalValue || '0',
      minimumCommitmentQty: minQty || null,
      commitmentUom: commitmentUom || null,
      commitmentPeriod: 'ANNUAL',
      paymentTerms: { kind: paymentKind as 'NET_30' },
      escalationClause:
        escType && escBase
          ? {
              type: escType as 'INDEXED',
              indexRef: escIndexRef || null,
              baseIndexValue: escBase,
              reviewFrequency: escFreq as 'QUARTERLY',
              capPct: escCap || null,
            }
          : null,
      terminationNoticeDays: 30,
      requireVendorCountersign: false,
      skipPoApprovalWithinContract: true,
      rateCards: rateCards.map((r) => ({
        ...r,
        effectiveFrom: r.effectiveFrom ? isoDay(r.effectiveFrom) : isoDay(validityStart),
        effectiveTo: r.effectiveTo ? isoDay(r.effectiveTo) : isoDay(validityEnd),
      })),
      clauses,
    };
    try {
      const res = await create.mutateAsync(body);
      push('Contract draft created', 'success');
      router.push(`/contracts/${res.id}`);
    } catch (e) {
      push(e instanceof Error ? e.message : 'Failed to create', 'error');
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl pb-10">
      <PageHeader
        breadcrumbs={[{ label: 'Contracts', href: '/contracts' }, { label: 'New' }]}
        title="New contract"
        description="Terms, rate card and clauses for a rate contract or framework agreement. It is saved as a draft for approval."
      />
      <StepIndicator steps={STEPS} current={step} className="mb-5" />

      <div className="space-y-3 rounded-lg border border-line bg-panel p-4 sm:p-5">
        {step === 0 && (
          <>
            <Field label="Title">
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <select
                  className={inputCls + ' pr-8'}
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {humanise(t)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vendor">
                <select
                  className={inputCls + ' pr-8'}
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                >
                  <option value="">{vendors ? 'Select…' : 'Loading vendors…'}</option>
                  {vendors?.items.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category">
                <input
                  className={inputCls}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </Field>
              <Field label="Est. total value (INR)">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={totalValue}
                  onChange={(e) => setTotalValue(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Validity start">
                <input
                  type="date"
                  className={inputCls}
                  value={validityStart}
                  onChange={(e) => setValidityStart(e.target.value)}
                />
              </Field>
              <Field label="Validity end">
                <input
                  type="date"
                  className={inputCls}
                  value={validityEnd}
                  onChange={(e) => setValidityEnd(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Payment terms">
                <select
                  className={inputCls + ' pr-8'}
                  value={paymentKind}
                  onChange={(e) => setPaymentKind(e.target.value)}
                >
                  {['NET_30', 'NET_45', 'NET_60', 'MSME_45'].map((k) => (
                    <option key={k} value={k}>
                      {humanise(k)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Min. commitment qty">
                <input
                  className={inputCls}
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                />
              </Field>
              <Field label="Commitment UOM">
                <input
                  className={inputCls}
                  value={commitmentUom}
                  onChange={(e) => setCommitmentUom(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            {rateCards.length === 0 && (
              <p className="py-2 text-body-sm text-muted">
                No rate rows yet. Add one per item or route this contract prices.
              </p>
            )}
            {rateCards.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-2 items-end gap-2 border-b border-line pb-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]"
              >
                <Field
                  label="Item / route"
                  className="col-span-2 sm:col-span-3 lg:col-span-1"
                >
                  <input
                    className={inputCls}
                    value={r.itemDesc}
                    onChange={(e) => setRc(i, { itemDesc: e.target.value })}
                  />
                </Field>
                <Field label="UOM">
                  <input
                    className={inputCls}
                    value={r.uom}
                    onChange={(e) => setRc(i, { uom: e.target.value })}
                  />
                </Field>
                <Field label="Year">
                  <input
                    type="number"
                    className={inputCls}
                    value={r.rateYear}
                    onChange={(e) => setRc(i, { rateYear: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Unit rate">
                  <input
                    className={inputCls}
                    value={r.unitRate}
                    onChange={(e) => setRc(i, { unitRate: e.target.value })}
                  />
                </Field>
                <Field label="Tax rate">
                  <input
                    className={inputCls}
                    value={r.taxRate}
                    onChange={(e) => setRc(i, { taxRate: e.target.value })}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove rate row ${i + 1}`}
                  onClick={() => setRateCards((rc) => rc.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addRateCard}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add rate row
            </Button>
          </>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <p className="text-caption text-muted">
              Select clauses from the library. Payment terms, Delivery SLA and Termination
              are mandatory.
            </p>
            {!library && (
              <div aria-busy="true" className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {library?.length === 0 && (
              <p className="py-2 text-body-sm text-muted">
                The clause library is empty. Add clauses in Contracts → Clause library.
              </p>
            )}
            {library?.map((l) => (
              <label
                key={l.id}
                className="flex items-start gap-2 border-b border-line pb-2 text-body-sm"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[var(--accent)]"
                  checked={selectedClauses.has(l.id)}
                  onChange={(e) => {
                    setSelectedClauses((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(l.id);
                      else n.delete(l.id);
                      return n;
                    });
                  }}
                />
                <span>
                  <span className="font-medium text-ink">{l.title}</span>
                  <span className="block text-caption text-muted">{l.contentText}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <>
            <p className="text-caption text-muted">
              Optional — indexed price escalation (e.g. diesel-linked).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <select
                  className={inputCls + ' pr-8'}
                  value={escType}
                  onChange={(e) => setEscType(e.target.value)}
                >
                  <option value="">None</option>
                  <option value="INDEXED">Indexed</option>
                  <option value="FIXED_STEP">Fixed step</option>
                </select>
              </Field>
              <Field label="Index reference">
                <input
                  className={inputCls}
                  value={escIndexRef}
                  onChange={(e) => setEscIndexRef(e.target.value)}
                />
              </Field>
              <Field label="Base index value">
                <input
                  className={inputCls}
                  value={escBase}
                  onChange={(e) => setEscBase(e.target.value)}
                />
              </Field>
              <Field label="Review frequency">
                <select
                  className={inputCls + ' pr-8'}
                  value={escFreq}
                  onChange={(e) => setEscFreq(e.target.value)}
                >
                  {['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'].map((f) => (
                    <option key={f} value={f}>
                      {humanise(f)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cap %">
                <input
                  className={inputCls}
                  value={escCap}
                  onChange={(e) => setEscCap(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        {step === 4 && (
          <div className="text-body-sm">
            <p className="mb-2 text-h3 font-semibold text-ink">Review</p>
            <Row label="Title" v={title || '—'} />
            <Row label="Type" v={humanise(contractType)} />
            <Row label="Category" v={category || '—'} />
            <Row label="Validity" v={`${validityStart} → ${validityEnd}`} />
            <Row label="Rate rows" v={String(rateCards.length)} />
            <Row label="Clauses" v={String(selectedClauses.size)} />
            <Row label="Escalation" v={escType ? humanise(escType) : 'None'} />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="primary" onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={submit}
            disabled={create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create draft'}
          </Button>
        )}
      </div>
    </div>
  );
}

// One definition for every text field, select and date input on this page —
// see components/ui/components/input.tsx.
const inputCls = controlClass;

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className={'block min-w-0 ' + (className ?? '')}>
      <span className="mb-1 block text-caption font-medium text-text">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, v }: { label: string; v: string }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1.5">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-ink">{v}</span>
    </div>
  );
}
