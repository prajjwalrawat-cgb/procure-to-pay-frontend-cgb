'use client';

import {
  Button,
  Input,
  PageHeader,
  controlClass,
} from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { EvaluationCriterionInput, RfqLineInput, RfqType } from '@/lib/shared';

import { usePlants } from '@/lib/api/refs';
import { useCreateRfq } from '@/lib/api/sourcing';
import { useRequisitionList } from '@/lib/api/requisitions';
import { inr } from '@/lib/format';
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

/**
 * Picks the PR this RFQ sources for.
 *
 * Only APPROVED / PARTIALLY_ISSUED requisitions can be linked — the API rejects
 * anything else with "Only an approved (or partially issued) PR can seed an
 * RFQ" — so the list offers exactly those rather than letting the buyer pick a
 * draft and find out on submit.
 */
function RequisitionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useRequisitionList('active');

  const linkable = (data?.items ?? []).filter(
    (r) => r.status === 'APPROVED' || r.status === 'PARTIALLY_ISSUED',
  );
  const q = query.trim().toLowerCase();
  const matches = q
    ? linkable.filter(
        (r) =>
          r.number.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.costCenter.code.toLowerCase().includes(q),
      )
    : linkable;
  const selected = linkable.find((r) => r.id === value);

  if (selected) {
    return (
      <div className="bg-panel flex items-center justify-between rounded-md border border-line px-3 py-2">
        <span className="text-body-sm">
          <span className="font-numeric text-ink">{selected.number}</span>{' '}
          <span className="text-muted">{selected.title}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-caption text-muted hover:text-danger"
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={
          isLoading ? 'Loading approved PRs…' : 'Search by PR number or title…'
        }
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-panel shadow-lg">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-caption text-muted">
              No approved requisition matches. Leave this blank to raise a standalone RFQ.
            </p>
          ) : (
            matches.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(r.id);
                  setQuery('');
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-caption hover:bg-canvas"
              >
                <span className="truncate">
                  <span className="font-numeric text-faint">{r.number}</span>{' '}
                  <span className="text-text">{r.title}</span>
                </span>
                <span className="shrink-0 text-muted">
                  {r.costCenter.code}, {inr(r.totalAmount)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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

  // Delivery defaults to the tenant's own first plant. It used to be a
  // hardcoded plant + state code, which quoted every RFQ against the wrong
  // place of supply for any tenant but the demo one.
  const { data: plantData } = usePlants();
  const defaultPlant = plantData?.items[0];

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
        deliveryLocation: {
          stateCode: defaultPlant?.stateCode ?? '',
          label: defaultPlant?.name ?? '',
        },
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
    <div className="mx-auto w-full max-w-[900px]">
      <PageHeader
        title="New RFQ"
        description="Define the lines, invite vendors and set the evaluation weights."
      />

      <Section title="1, Basics">
        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Cement mill liner segments Q3-26"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label="RFQ type">
            <select
              className={controlClass}
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
              className={controlClass}
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
            <RequisitionPicker value={requisitionId} onChange={setRequisitionId} />
            <p className="mt-1 text-caption text-muted">
              {requisitionId
                ? 'The award will raise a PO against this requisition and draw down its quantities.'
                : 'Leave blank only for a buy with no requisition behind it — the award then creates a standalone spot-buy PO.'}
            </p>
          </Field>
        </div>
      </Section>

      <Section title="2, Lines">
        {lines.map((l, i) => (
          <div key={i} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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

      <Section title="3, Evaluation criteria">
        <div className="space-y-2">
          {criteria.map((c, i) => (
            <div key={c.key} className="flex items-center gap-2 text-body-sm">
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
              {c.auto && <span className="text-micro text-accent-2">auto-scored</span>}
            </div>
          ))}
          <p
            className={
              weightSum === 100 ? 'text-caption text-accent-2' : 'text-caption text-danger'
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
    <div className="mb-4 rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-3 text-body font-semibold text-ink">{title}</h2>
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
      <span className="mb-1 block text-caption text-muted">{label}</span>
      {children}
    </label>
  );
}
