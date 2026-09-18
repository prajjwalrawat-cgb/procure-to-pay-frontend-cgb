'use client';

import {
  PageHeader,
  StepIndicator,
  controlClass,
} from '@/components/ui';

import type { ClauseInput, ContractCreateInput, RateCardInput } from '@/lib/shared';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useClauseLibrary, useCreateContract } from '@/lib/api/contracts';
import { useVendorList } from '@/lib/api/vendors';
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
    <div className="max-w-4xl pb-10">
      <Link
        href="/contracts"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-text"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Contracts
      </Link>
      <PageHeader title="New contract" />
      <StepIndicator steps={STEPS} current={step} className="mb-5" />

      <div className="space-y-3 rounded-lg border border-line bg-panel p-5">
        {step === 0 && (
          <>
            <Field label="Title">
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select
                  className={inputCls}
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vendor">
                <select
                  className={inputCls}
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {vendors?.items.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                  value={totalValue}
                  onChange={(e) => setTotalValue(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-3 gap-3">
              <Field label="Payment terms">
                <select
                  className={inputCls}
                  value={paymentKind}
                  onChange={(e) => setPaymentKind(e.target.value)}
                >
                  {['NET_30', 'NET_45', 'NET_60', 'MSME_45'].map((k) => (
                    <option key={k} value={k}>
                      {k}
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
            {rateCards.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-6 items-end gap-2 border-b border-line pb-2"
              >
                <Field label="Item / route">
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
                <button
                  type="button"
                  className="mb-1.5 text-danger"
                  onClick={() => setRateCards((rc) => rc.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRateCard}
              className="flex items-center gap-1 text-[13px] text-accent-2"
            >
              <Plus className="h-3.5 w-3.5" /> Add rate row
            </button>
          </>
        )}

        {step === 2 && (
          <div className="space-y-2">
            <p className="text-[12px] text-muted">
              Select clauses from the library. Payment terms, Delivery SLA and Termination
              are mandatory.
            </p>
            {library?.map((l) => (
              <label
                key={l.id}
                className="flex items-start gap-2 border-b border-line pb-2 text-[13px]"
              >
                <input
                  type="checkbox"
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
                  <span className="block text-[12px] text-muted">{l.contentText}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <>
            <p className="text-[12px] text-muted">
              Optional — indexed price escalation (e.g. diesel-linked).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select
                  className={inputCls}
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
                  className={inputCls}
                  value={escFreq}
                  onChange={(e) => setEscFreq(e.target.value)}
                >
                  {['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'].map((f) => (
                    <option key={f} value={f}>
                      {f}
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
          <div className="text-[13px]">
            <p className="mb-2 font-medium text-ink">Review</p>
            <Row label="Title" v={title} />
            <Row label="Type" v={contractType} />
            <Row label="Category" v={category} />
            <Row label="Validity" v={`${validityStart} → ${validityEnd}`} />
            <Row label="Rate rows" v={String(rateCards.length)} />
            <Row label="Clauses" v={String(selectedClauses.size)} />
            <Row label="Escalation" v={escType || 'None'} />
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="rounded-md border border-line px-4 py-1.5 text-[13px] text-text disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded-md bg-ink px-4 py-1.5 text-[13px] font-medium text-white"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="rounded-md bg-accent px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            Create draft
          </button>
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, v }: { label: string; v: string }): React.JSX.Element {
  return (
    <div className="flex justify-between border-b border-line py-1">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{v}</span>
    </div>
  );
}
