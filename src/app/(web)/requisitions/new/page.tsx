'use client';

import { Button, Pill } from '@/components/ui';
import { ArrowLeft, Plus, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type {
  CostCenterRef,
  ItemListItem,
  PlantRef,
  RequisitionCreateInput,
  RequisitionLineInput,
  VendorRef,
} from '@/lib/shared';

import { apiFetch } from '@/lib/api-client';
import { useCostCenters, usePlants, useVendors } from '@/lib/api/refs';
import {
  useBudgetCheck,
  useCreateRequisition,
  useItemSearch,
  useSubmitRequisition,
} from '@/lib/api/requisitions';
import { inr } from '@/lib/format';
import { NON_CATALOG_REASONS, PRIORITIES } from '@/lib/refs';
import { useToastStore } from '@/store/toast-store';

interface DraftLine {
  key: string;
  itemId: string | null;
  skuCode: string | null;
  itemDesc: string;
  hsnCode: string;
  uom: string;
  qty: string;
  unitPrice: string;
  discountPct: string;
  taxRate: string;
  preferredVendorId: string;
  reasonCode: string;
}

const STEPS = ['Basics', 'Line items', 'Attachments', 'Review'];

let lineSeq = 0;
function blankLine(catalogued: boolean): DraftLine {
  lineSeq += 1;
  return {
    key: `l${lineSeq}`,
    itemId: catalogued ? '' : null,
    skuCode: null,
    itemDesc: '',
    hsnCode: '',
    uom: 'NOS',
    qty: '1',
    unitPrice: '0',
    discountPct: '0',
    taxRate: '18',
    preferredVendorId: '',
    reasonCode: '',
  };
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function lineTotal(l: DraftLine): number {
  const base = num(l.qty) * num(l.unitPrice);
  const afterDisc = base * (1 - num(l.discountPct) / 100);
  return afterDisc * (1 + num(l.taxRate) / 100);
}

export default function NewRequisitionPage(): React.JSX.Element {
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const create = useCreateRequisition();

  const { data: ccData } = useCostCenters();
  const { data: plantData } = usePlants();
  const { data: vendorData } = useVendors();
  const costCenters = useMemo(() => ccData?.items ?? [], [ccData]);
  const plants = useMemo(() => plantData?.items ?? [], [plantData]);
  const vendors = useMemo(() => vendorData?.items ?? [], [vendorData]);

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');

  // Default the plant to the first tenant plant once the list loads.
  useEffect(() => {
    if (!plantId && plants.length > 0) setPlantId(plants[0].id);
  }, [plantId, plants]);
  const [neededBy, setNeededBy] = useState('');
  const [priority, setPriority] = useState('STANDARD');
  const [justification, setJustification] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine(true)]);

  const total = useMemo(() => lines.reduce((s, l) => s + lineTotal(l), 0), [lines]);
  const budget = useBudgetCheck(costCenterId || null, total.toFixed(2));

  // Slice-4 submit gate uses the last created id so a failed submit still lands
  // the draft's detail page.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const submit = useSubmitRequisition(createdId ?? '');

  const updateLine = (key: string, patch: Partial<DraftLine>): void =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const step1Valid =
    title.trim().length >= 5 &&
    costCenterId &&
    plantId &&
    neededBy &&
    justification.trim().length >= 20;
  const step2Valid =
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.itemDesc.trim().length > 0 &&
        num(l.qty) > 0 &&
        (l.itemId !== null || l.reasonCode !== ''),
    );

  const buildBody = (): RequisitionCreateInput => ({
    title: title.trim(),
    businessJustification: justification.trim(),
    costCenterId,
    plantId,
    deliveryLocation: deliveryLocation.trim() || null,
    neededBy: new Date(`${neededBy}T00:00:00.000Z`).toISOString(),
    priority: priority as RequisitionCreateInput['priority'],
    lines: lines.map((l): RequisitionLineInput => ({
      itemId: l.itemId || null,
      itemDesc: l.itemDesc.trim(),
      uom: l.uom,
      qty: l.qty,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct || '0',
      taxRate: l.taxRate || '0',
      hsnCode: l.hsnCode || null,
      preferredVendorId: l.preferredVendorId || null,
      reasonCode: l.itemId ? null : (l.reasonCode as RequisitionLineInput['reasonCode']),
    })),
  });

  const onSaveDraft = (): void => {
    create.mutate(buildBody(), {
      onSuccess: (res) => {
        toast('Draft saved', 'success');
        router.push(`/requisitions/${res.id}`);
      },
      onError: (e) => toast((e as Error).message, 'error'),
    });
  };

  const onSubmitForApproval = (): void => {
    create.mutate(buildBody(), {
      onSuccess: async (res) => {
        setCreatedId(res.id);
        // Submit against the freshly-returned id directly — the pre-bound
        // useSubmitRequisition hook still holds the previous (empty) id this tick.
        try {
          await apiFetch(`/requisitions/${res.id}/submit`, { method: 'POST' });
          toast('Submitted for approval', 'success');
        } catch (e) {
          toast(`Saved as draft — ${(e as Error).message}`, 'error');
        }
        router.push(`/requisitions/${res.id}`);
      },
      onError: (e) => toast((e as Error).message, 'error'),
    });
  };

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <Link
        href="/requisitions"
        className="text-muted mb-3 inline-flex items-center gap-1 text-[12px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to requisitions
      </Link>
      <h1 className="tracking-heading text-ink mb-4 text-[20px] font-semibold">
        New requisition
      </h1>

      {/* Step indicator */}
      <div className="mb-5 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n === step ? 'active' : n < step ? 'done' : 'todo';
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className={
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ' +
                  (state === 'active'
                    ? 'bg-ink text-white'
                    : state === 'done'
                      ? 'bg-accent-wash text-accent-2'
                      : 'bg-canvas text-faint')
                }
              >
                {n}
              </span>
              <span
                className={
                  'text-[12px] font-medium ' +
                  (state === 'todo' ? 'text-faint' : 'text-text')
                }
              >
                {label}
              </span>
              {n < STEPS.length && <span className="bg-line h-px w-6" />}
            </div>
          );
        })}
      </div>

      <div className="border-line bg-panel rounded-lg border p-5">
        {step === 1 && (
          <StepBasics
            title={title}
            setTitle={setTitle}
            costCenterId={costCenterId}
            setCostCenterId={setCostCenterId}
            plantId={plantId}
            setPlantId={setPlantId}
            deliveryLocation={deliveryLocation}
            setDeliveryLocation={setDeliveryLocation}
            neededBy={neededBy}
            setNeededBy={setNeededBy}
            priority={priority}
            setPriority={setPriority}
            justification={justification}
            setJustification={setJustification}
            total={total}
            budget={budget.data ?? null}
            budgetError={budget.isError}
            costCenters={costCenters}
            plants={plants}
          />
        )}
        {step === 2 && (
          <StepLines
            lines={lines}
            setLines={setLines}
            updateLine={updateLine}
            total={total}
            vendors={vendors}
          />
        )}
        {step === 3 && <StepAttachments />}
        {step === 4 && (
          <StepReview
            title={title}
            costCenterId={costCenterId}
            priority={priority}
            neededBy={neededBy}
            lineCount={lines.length}
            total={total}
            budget={budget.data ?? null}
            budgetError={budget.isError}
            costCenters={costCenters}
          />
        )}
      </div>

      {/* Wizard controls */}
      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          Back
        </Button>
        {step < 4 ? (
          <Button
            variant="accent"
            size="sm"
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              disabled={create.isPending || !step1Valid || !step2Valid}
              onClick={onSaveDraft}
            >
              Save as draft
            </Button>
            <Button
              variant="accent"
              size="sm"
              disabled={
                create.isPending || submit.isPending || !step1Valid || !step2Valid
              }
              onClick={onSubmitForApproval}
            >
              Submit for approval
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 1 ───────────────────────────────────────────────────────────────────

function StepBasics(props: {
  title: string;
  setTitle: (v: string) => void;
  costCenterId: string;
  setCostCenterId: (v: string) => void;
  plantId: string;
  setPlantId: (v: string) => void;
  deliveryLocation: string;
  setDeliveryLocation: (v: string) => void;
  neededBy: string;
  setNeededBy: (v: string) => void;
  priority: string;
  setPriority: (v: string) => void;
  justification: string;
  setJustification: (v: string) => void;
  total: number;
  budget: import('@/lib/shared').BudgetCheckResult | null;
  budgetError: boolean;
  costCenters: CostCenterRef[];
  plants: PlantRef[];
}): React.JSX.Element {
  const plant = props.plants.find((p) => p.id === props.plantId);
  return (
    <div className="flex flex-col gap-4">
      <Field label="Title" hint="Minimum 5 characters">
        <input
          value={props.title}
          onChange={(e) => props.setTitle(e.target.value)}
          placeholder="e.g. Replacement bearings for Mill #3"
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Cost centre">
          <select
            value={props.costCenterId}
            onChange={(e) => props.setCostCenterId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select cost centre…</option>
            {props.costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.code} · {cc.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plant">
          <select
            value={props.plantId}
            onChange={(e) => {
              props.setPlantId(e.target.value);
              const p = props.plants.find((x) => x.id === e.target.value);
              if (p && !props.deliveryLocation) props.setDeliveryLocation(p.name);
            }}
            className={inputCls}
          >
            {props.plants.length === 0 && <option value="">Loading plants…</option>}
            {props.plants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Live budget chip */}
      <BudgetChip
        costCenterId={props.costCenterId}
        total={props.total}
        budget={props.budget}
        error={props.budgetError}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Delivery location">
          <input
            value={props.deliveryLocation}
            onChange={(e) => props.setDeliveryLocation(e.target.value)}
            placeholder={plant?.name ?? 'Delivery location'}
            className={inputCls}
          />
        </Field>
        <Field label="Needed by">
          <input
            type="date"
            value={props.neededBy}
            onChange={(e) => props.setNeededBy(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Priority">
        <select
          value={props.priority}
          onChange={(e) => props.setPriority(e.target.value)}
          className={inputCls}
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Business justification" hint="Minimum 20 characters">
        <textarea
          value={props.justification}
          onChange={(e) => props.setJustification(e.target.value)}
          rows={3}
          placeholder="Why is this purchase required?"
          className={inputCls}
        />
      </Field>
    </div>
  );
}

function BudgetChip({
  costCenterId,
  total,
  budget,
  error,
}: {
  costCenterId: string;
  total: number;
  budget: import('@/lib/shared').BudgetCheckResult | null;
  error: boolean;
}): React.JSX.Element | null {
  if (!costCenterId) return null;
  if (error || !budget) {
    return (
      <div className="bg-canvas text-muted rounded-sm px-3 py-2 text-[12px]">
        Budget data unavailable for this cost centre.
      </div>
    );
  }
  const remaining = num(budget.remaining);
  const allocated = num(budget.allocated);
  const pct = allocated > 0 ? (remaining / allocated) * 100 : 0;
  const tone =
    pct < 10
      ? 'bg-danger-wash text-danger'
      : pct < 30
        ? 'bg-warn-wash text-warn'
        : 'bg-accent-wash text-accent-2';
  return (
    <div
      className={`flex items-center justify-between rounded-sm px-3 py-2 text-[12px] ${tone}`}
    >
      <span className="font-medium">
        {inr(budget.remaining)} available of {inr(budget.allocated)} allocated
      </span>
      {budget.wouldBreachBy && Number(budget.wouldBreachBy) > 0 ? (
        <span className="font-numeric font-semibold">
          Breaches by {inr(budget.wouldBreachBy)}
        </span>
      ) : (
        <span className="font-numeric">This PR: {inr(total.toFixed(2))}</span>
      )}
    </div>
  );
}

// ── Step 2 ───────────────────────────────────────────────────────────────────

function StepLines({
  lines,
  setLines,
  updateLine,
  total,
  vendors,
}: {
  lines: DraftLine[];
  setLines: React.Dispatch<React.SetStateAction<DraftLine[]>>;
  updateLine: (key: string, patch: Partial<DraftLine>) => void;
  total: number;
  vendors: VendorRef[];
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {lines.map((line, i) => (
          <LineEditor
            key={line.key}
            index={i}
            line={line}
            vendors={vendors}
            update={(patch) => updateLine(line.key, patch)}
            remove={() =>
              setLines((prev) =>
                prev.length > 1 ? prev.filter((l) => l.key !== line.key) : prev,
              )
            }
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => setLines((prev) => [...prev, blankLine(true)])}
        >
          <Plus className="h-3.5 w-3.5" /> Add catalogued item
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLines((prev) => [...prev, blankLine(false)])}
        >
          <Plus className="h-3.5 w-3.5" /> Add non-catalogued item
        </Button>
        <span className="font-numeric text-ink ml-auto text-[14px] font-semibold">
          PR total {inr(total.toFixed(2))}
        </span>
      </div>
    </div>
  );
}

function LineEditor({
  index,
  line,
  vendors,
  update,
  remove,
}: {
  index: number;
  line: DraftLine;
  vendors: VendorRef[];
  update: (patch: Partial<DraftLine>) => void;
  remove: () => void;
}): React.JSX.Element {
  const isCatalogued = line.itemId !== null;
  return (
    <div className="border-line bg-canvas/40 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-faint text-[11px] font-semibold uppercase tracking-wide">
          Line {index + 1}
          {!isCatalogued && (
            <Pill variant="warn" className="ml-2">
              Non-catalogued
            </Pill>
          )}
        </span>
        <button
          type="button"
          onClick={remove}
          aria-label="Remove line"
          className="text-muted hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {isCatalogued ? (
        <ItemPicker
          value={line.itemDesc}
          onPick={(item) =>
            update({
              itemId: item.id,
              skuCode: item.skuCode,
              itemDesc: item.name,
              hsnCode: item.hsnCode,
              taxRate: item.gstRate,
              uom: item.primaryUom,
              unitPrice: item.lastPaidPrice ?? line.unitPrice,
              preferredVendorId: item.preferredVendor?.id ?? '',
            })
          }
          onType={(v) => update({ itemDesc: v })}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={line.itemDesc}
            onChange={(e) => update({ itemDesc: e.target.value })}
            placeholder="Item description"
            className={inputCls}
          />
          <select
            value={line.reasonCode}
            onChange={(e) => update({ reasonCode: e.target.value })}
            className={inputCls}
          >
            <option value="">Reason code…</option>
            {NON_CATALOG_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
        <SmallField label="Qty">
          <input
            value={line.qty}
            onChange={(e) => update({ qty: e.target.value })}
            inputMode="decimal"
            className={inputCls}
          />
        </SmallField>
        <SmallField label="UoM">
          <input
            value={line.uom}
            onChange={(e) => update({ uom: e.target.value })}
            className={inputCls}
          />
        </SmallField>
        <SmallField label="Unit price">
          <input
            value={line.unitPrice}
            onChange={(e) => update({ unitPrice: e.target.value })}
            inputMode="decimal"
            className={inputCls}
          />
        </SmallField>
        <SmallField label="Disc %">
          <input
            value={line.discountPct}
            onChange={(e) => update({ discountPct: e.target.value })}
            inputMode="decimal"
            className={inputCls}
          />
        </SmallField>
        <SmallField label="Tax %">
          <input
            value={line.taxRate}
            onChange={(e) => update({ taxRate: e.target.value })}
            inputMode="decimal"
            className={inputCls}
          />
        </SmallField>
        <SmallField label="HSN">
          <input
            value={line.hsnCode}
            onChange={(e) => update({ hsnCode: e.target.value })}
            className={inputCls}
          />
        </SmallField>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="flex flex-1 items-center gap-2">
          <span className="text-muted text-[11px]">Preferred vendor</span>
          <select
            value={line.preferredVendorId}
            onChange={(e) => update({ preferredVendorId: e.target.value })}
            className={inputCls + ' max-w-xs'}
          >
            <option value="">None</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.isMsme ? ' (MSME)' : ''}
              </option>
            ))}
          </select>
        </label>
        <span className="font-numeric text-ink text-[13px] font-semibold">
          {inr(lineTotal(line).toFixed(2))}
        </span>
      </div>
    </div>
  );
}

function ItemPicker({
  value,
  onPick,
  onType,
}: {
  value: string;
  onPick: (item: ItemListItem) => void;
  onType: (v: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const { data } = useItemSearch(value);
  const items = data?.items ?? [];
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onType(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search catalogue (SKU or name)…"
        className={inputCls}
      />
      {open && items.length > 0 && (
        <div className="border-line bg-panel absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-sm border shadow-lg">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(it);
                setOpen(false);
              }}
              className="hover:bg-canvas flex w-full items-center justify-between px-3 py-2 text-left text-[12px]"
            >
              <span>
                <span className="font-numeric text-faint">{it.skuCode}</span>{' '}
                <span className="text-text">{it.name}</span>
              </span>
              <span className="text-muted">
                {it.hsnCode} · {it.gstRate}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 3 ───────────────────────────────────────────────────────────────────

function StepAttachments(): React.JSX.Element {
  return (
    <div className="border-line text-muted flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
      <UploadCloud className="text-faint h-8 w-8" />
      <div className="text-text text-[13px] font-medium">Drop files to attach</div>
      <p className="text-[12px]">
        Quotes, specs and drawings. Upload is stubbed for this slice — you can continue
        without attachments.
      </p>
    </div>
  );
}

// ── Step 4 ───────────────────────────────────────────────────────────────────

function StepReview(props: {
  title: string;
  costCenterId: string;
  priority: string;
  neededBy: string;
  lineCount: number;
  total: number;
  budget: import('@/lib/shared').BudgetCheckResult | null;
  budgetError: boolean;
  costCenters: CostCenterRef[];
}): React.JSX.Element {
  const cc = props.costCenters.find((c) => c.id === props.costCenterId);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <ReviewRow label="Title" value={props.title} />
        <ReviewRow label="Cost centre" value={cc ? `${cc.code} · ${cc.name}` : '—'} />
        <ReviewRow label="Priority" value={props.priority} />
        <ReviewRow
          label="Needed by"
          value={
            props.neededBy ? new Date(props.neededBy).toLocaleDateString('en-IN') : '—'
          }
        />
        <ReviewRow label="Lines" value={String(props.lineCount)} />
        <ReviewRow label="PR total" value={inr(props.total.toFixed(2))} strong />
      </div>

      <div>
        <h3 className="text-ink mb-2 text-[13px] font-semibold">Budget check</h3>
        <BudgetChip
          costCenterId={props.costCenterId}
          total={props.total}
          budget={props.budget}
          error={props.budgetError}
        />
      </div>
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

const inputCls =
  'border-line bg-panel focus-visible:ring-accent w-full rounded-sm border px-3 py-2 text-[13px] outline-none focus-visible:ring-2';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted flex items-center gap-2 text-[12px] font-medium">
        {label}
        {hint && <span className="text-faint text-[11px]">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SmallField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-faint text-[10px] uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function ReviewRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): React.JSX.Element {
  return (
    <div className="border-line bg-canvas/40 flex items-center justify-between rounded-sm border px-3 py-2">
      <span className="text-muted text-[12px]">{label}</span>
      <span
        className={
          'font-numeric text-[13px] ' + (strong ? 'text-ink font-semibold' : 'text-text')
        }
      >
        {value}
      </span>
    </div>
  );
}
