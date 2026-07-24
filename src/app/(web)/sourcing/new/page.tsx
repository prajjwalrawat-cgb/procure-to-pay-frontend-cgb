'use client';

import { Button, Input } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type {
  EvaluationCriterionInput,
  RfqLineInput,
  RfqType,
} from '@/lib/shared';

import { useCreateRfq } from '@/lib/api/sourcing';
import { useToastStore } from '@/store/toast-store';

const DEFAULT_CRITERIA: EvaluationCriterionInput[] = [
  { key: 'price', label: 'Price', weight: 60, auto: true },
  { key: 'delivery', label: 'Delivery', weight: 20, auto: true },
  { key: 'quality', label: 'Quality', weight: 10, auto: false },
  { key: 'msme', label: 'MSME preference', weight: 10, auto: false },
];

interface LineForm {
  itemDesc: string;
  uom: string;
  qtyRequired: string;
  qtyMinSplit: string;
  hsnCode: string;
  unitWeightKg: string;
}

const emptyLine: LineForm = {
  itemDesc: '',
  uom: 'nos',
  qtyRequired: '',
  qtyMinSplit: '0',
  hsnCode: '',
  unitWeightKg: '',
};

export default function NewRfqPage(): React.JSX.Element {
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const create = useCreateRfq();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Mechanical > Wear parts');
  const [rfqType, setRfqType] = useState<RfqType>('TWO_ENVELOPE');
  const [incoterm, setIncoterm] = useState('DDP');
  const [paymentTerms, setPaymentTerms] = useState('NET_45');
  const [estimatedValue, setEstimatedValue] = useState('3360000');
  const [requisitionId, setRequisitionId] = useState('');
  const [criteria, setCriteria] = useState<EvaluationCriterionInput[]>(DEFAULT_CRITERIA);
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }]);

  const weightSum = criteria.reduce((a, c) => a + c.weight, 0);

  const submit = (): void => {
    const rfqLines: RfqLineInput[] = lines.map((l) => ({
      itemDesc: l.itemDesc,
      uom: l.uom,
      qtyRequired: l.qtyRequired || '0',
      qtyMinSplit: l.qtyMinSplit || '0',
      hsnCode: l.hsnCode || null,
      taxRate: '0.18',
      unitWeightKg: l.unitWeightKg || null,
    }));
    create.mutate(
      {
        title,
        category,
        rfqType,
        currency: 'INR',
        incotermDefault: incoterm,
        deliveryLocation: { stateCode: '17', label: 'Lumshnong plant' },
        paymentTermsDefault: paymentTerms,
        estimatedValue,
        evaluationCriteria: criteria,
        requiredDocuments: {},
        allowPartialAward: false,
        allowSplitAward: true,
        maxAwardVendors: 2,
        allowBidRevision: false,
        revisionCountMax: 0,
        blindEvaluation: false,
        isReverseAuction: rfqType === 'REVERSE_AUCTION',
        requisitionId: requisitionId || null,
        lines: rfqLines,
      } as Parameters<typeof create.mutate>[0],
      {
        onSuccess: (r) => {
          toast('RFQ draft created', 'success');
          router.push(`/sourcing/${r.id}/publish`);
        },
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  return (
    <div className="mx-auto max-w-[900px]">
      <h1 className="tracking-heading text-ink mb-4 text-[20px] font-semibold">
        New RFQ
      </h1>

      <Section title="1 · Basics">
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cement mill liner segments Q3-26"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label="RFQ type">
            <select
              className="border-line bg-panel h-9 w-full rounded-md border px-2 text-[13px]"
              value={rfqType}
              onChange={(e) => setRfqType(e.target.value as RfqType)}
            >
              <option value="SINGLE_ENVELOPE">Single envelope</option>
              <option value="TWO_ENVELOPE">Two envelope</option>
              <option value="REVERSE_AUCTION">Reverse auction</option>
            </select>
          </Field>
          <Field label="INCOTERM">
            <select
              className="border-line bg-panel h-9 w-full rounded-md border px-2 text-[13px]"
              value={incoterm}
              onChange={(e) => setIncoterm(e.target.value)}
            >
              {['DDP', 'EXW', 'FOB', 'CIF'].map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment terms">
            <Input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
            />
          </Field>
          <Field label="Estimated value (₹)">
            <Input
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
            />
          </Field>
          <Field label="Link PR (optional)">
            <Input
              value={requisitionId}
              onChange={(e) => setRequisitionId(e.target.value)}
              placeholder="pr_…"
            />
          </Field>
        </div>
      </Section>

      <Section title="2 · Lines">
        {lines.map((l, i) => (
          <div key={i} className="mb-2 grid grid-cols-6 gap-2">
            <Input
              placeholder="Item"
              value={l.itemDesc}
              onChange={(e) => updateLine(setLines, i, 'itemDesc', e.target.value)}
            />
            <Input
              placeholder="UOM"
              value={l.uom}
              onChange={(e) => updateLine(setLines, i, 'uom', e.target.value)}
            />
            <Input
              placeholder="Qty"
              value={l.qtyRequired}
              onChange={(e) => updateLine(setLines, i, 'qtyRequired', e.target.value)}
            />
            <Input
              placeholder="Min split"
              value={l.qtyMinSplit}
              onChange={(e) => updateLine(setLines, i, 'qtyMinSplit', e.target.value)}
            />
            <Input
              placeholder="HSN"
              value={l.hsnCode}
              onChange={(e) => updateLine(setLines, i, 'hsnCode', e.target.value)}
            />
            <Input
              placeholder="kg/unit"
              value={l.unitWeightKg}
              onChange={(e) => updateLine(setLines, i, 'unitWeightKg', e.target.value)}
            />
          </div>
        ))}
        <Button variant="ghost" onClick={() => setLines((p) => [...p, { ...emptyLine }])}>
          + Add line
        </Button>
      </Section>

      <Section title="3 · Evaluation criteria">
        <div className="space-y-2">
          {criteria.map((c, i) => (
            <div key={c.key} className="flex items-center gap-2 text-[13px]">
              <span className="w-40">{c.label}</span>
              <Input
                className="w-20"
                value={String(c.weight)}
                onChange={(e) =>
                  setCriteria((p) =>
                    p.map((x, j) =>
                      j === i ? { ...x, weight: Number(e.target.value) || 0 } : x,
                    ),
                  )
                }
              />
              <span className="text-muted">%</span>
              {c.auto && <span className="text-accent-2 text-[11px]">auto-scored</span>}
            </div>
          ))}
          <p
            className={
              weightSum === 100 ? 'text-accent-2 text-[12px]' : 'text-danger text-[12px]'
            }
          >
            Weights sum: {weightSum}% {weightSum === 100 ? '✓' : '(must equal 100)'}
          </p>
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push('/sourcing')}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={weightSum !== 100 || !title || create.isPending}
          onClick={submit}
        >
          {create.isPending ? 'Creating…' : 'Create draft → invitations'}
        </Button>
      </div>
    </div>
  );
}

function updateLine(
  setLines: React.Dispatch<React.SetStateAction<LineForm[]>>,
  i: number,
  key: keyof LineForm,
  value: string,
): void {
  setLines((p) => p.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel mb-4 rounded-lg border p-4">
      <h2 className="text-ink mb-3 text-[14px] font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="mb-3 block">
      <span className="text-muted mb-1 block text-[12px]">{label}</span>
      {children}
    </label>
  );
}
