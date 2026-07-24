'use client';

import { Button, Input, Pill } from '@procureflow/ui';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { RequisitionLineInput, RequisitionUpdateInput } from '@procureflow/shared';

import { useCostCenters, usePlants } from '@/lib/api/refs';
import { useRequisition, useUpdateRequisition } from '@/lib/api/requisitions';
import { inr } from '@/lib/format';
import { PRIORITIES } from '@/lib/refs';
import { useToastStore } from '@/store/toast-store';

interface EditLine {
  key: string;
  itemId: string | null;
  itemDesc: string;
  uom: string;
  qty: string;
  unitPrice: string;
  discountPct: string;
  taxRate: string;
  hsnCode: string;
  preferredVendorId: string | null;
  reasonCode: string | null;
  isCatalogued: boolean;
}

let keySeq = 0;
const nextKey = (): string => `l${keySeq++}`;

export default function EditRequisitionPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data, isLoading } = useRequisition(id);
  const update = useUpdateRequisition(id);
  const { data: costCenters } = useCostCenters();
  const { data: plants } = usePlants();

  const [title, setTitle] = useState('');
  const [justification, setJustification] = useState('');
  const [priority, setPriority] = useState('STANDARD');
  const [neededBy, setNeededBy] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [lines, setLines] = useState<EditLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Prefill once from the loaded requisition.
  useEffect(() => {
    if (!data || hydrated) return;
    setTitle(data.title);
    setJustification(data.businessJustification);
    setPriority(data.priority);
    setNeededBy(data.neededBy ? data.neededBy.slice(0, 10) : '');
    setDeliveryLocation(data.deliveryLocation ?? '');
    setCostCenterId(data.costCenter.id);
    setPlantId(data.plant.id);
    setLines(
      data.lines.map((l) => ({
        key: nextKey(),
        itemId: l.itemId,
        itemDesc: l.itemDesc,
        uom: l.uom,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        taxRate: l.taxRate,
        hsnCode: l.hsnCode ?? '',
        preferredVendorId: l.preferredVendor?.id ?? null,
        reasonCode: l.reasonCode,
        isCatalogued: l.isCatalogued,
      })),
    );
    setHydrated(true);
  }, [data, hydrated]);

  if (isLoading || !data) {
    return <div className="text-muted p-8 text-center">Loading…</div>;
  }

  // DRAFT-only guard (backend enforces this too).
  if (data.status !== 'DRAFT') {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <p className="text-ink text-[15px] font-semibold">
          This requisition can’t be edited.
        </p>
        <p className="text-muted mt-1 text-[13px]">
          Only <b>Draft</b> requisitions are editable — {data.number} is{' '}
          <Pill variant="gray">{data.status}</Pill>.
        </p>
        <Link
          href={`/requisitions/${id}`}
          className="text-accent mt-3 inline-block text-[13px]"
        >
          ← Back to {data.number}
        </Link>
      </div>
    );
  }

  const updateLine = (key: string, patch: Partial<EditLine>): void =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string): void =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const addLine = (): void =>
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        itemId: null,
        itemDesc: '',
        uom: 'nos',
        qty: '1',
        unitPrice: '0',
        discountPct: '0',
        taxRate: '0.18',
        hsnCode: '',
        preferredVendorId: null,
        reasonCode: 'OTHER',
        isCatalogued: false,
      },
    ]);

  const num = (s: string): number => Number(s) || 0;
  const lineTotal = (l: EditLine): number =>
    num(l.qty) * num(l.unitPrice) * (1 - num(l.discountPct)) * (1 + num(l.taxRate));
  const prTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);

  const valid =
    title.trim().length >= 5 &&
    justification.trim().length >= 20 &&
    costCenterId &&
    plantId &&
    lines.length > 0 &&
    lines.every((l) => l.itemDesc.trim() && num(l.qty) > 0);

  const onSave = (): void => {
    const body: RequisitionUpdateInput = {
      title: title.trim(),
      businessJustification: justification.trim(),
      costCenterId,
      plantId,
      deliveryLocation: deliveryLocation.trim() || null,
      priority: priority as RequisitionUpdateInput['priority'],
      neededBy: neededBy
        ? new Date(`${neededBy}T00:00:00.000Z`).toISOString()
        : undefined,
      lines: lines.map((l): RequisitionLineInput => ({
        itemId: l.itemId,
        itemDesc: l.itemDesc.trim(),
        uom: l.uom,
        qty: l.qty || '0',
        unitPrice: l.unitPrice || '0',
        discountPct: l.discountPct || '0',
        taxRate: l.taxRate || '0',
        hsnCode: l.hsnCode || null,
        preferredVendorId: l.preferredVendorId,
        reasonCode: l.itemId
          ? null
          : ((l.reasonCode ?? 'OTHER') as RequisitionLineInput['reasonCode']),
      })),
    };
    update.mutate(body, {
      onSuccess: () => {
        toast('Requisition updated', 'success');
        router.push(`/requisitions/${id}`);
      },
      onError: (e) => toast((e as Error).message, 'error'),
    });
  };

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <Link
        href={`/requisitions/${id}`}
        className="text-muted mb-3 inline-flex items-center gap-1 text-[12px]"
      >
        <ArrowLeft size={14} /> Back to {data.number}
      </Link>
      <h1 className="tracking-heading text-ink mb-4 text-[20px] font-semibold">
        Edit {data.number} <Pill variant="gray">Draft</Pill>
      </h1>

      <Section title="Basics">
        <Field label="Title · min 5 characters">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost centre">
            <select
              className="border-line bg-panel h-9 w-full rounded-md border px-2 text-[13px]"
              value={costCenterId}
              onChange={(e) => setCostCenterId(e.target.value)}
            >
              {costCenters?.items.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.code} · {cc.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plant">
            <select
              className="border-line bg-panel h-9 w-full rounded-md border px-2 text-[13px]"
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
            >
              {plants?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Delivery location">
            <Input
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
            />
          </Field>
          <Field label="Needed by">
            <input
              type="date"
              className="border-line bg-panel h-9 w-full rounded-md border px-2 text-[13px]"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
            />
          </Field>
          <Field label="Priority">
            <select
              className="border-line bg-panel h-9 w-full rounded-md border px-2 text-[13px]"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Business justification · min 20 characters">
          <textarea
            className="border-line bg-panel w-full rounded-md border p-2 text-[13px]"
            rows={2}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Line items">
        {lines.map((l) => (
          <div key={l.key} className="border-line mb-3 rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Input
                className="flex-1"
                placeholder="Item description"
                value={l.itemDesc}
                onChange={(e) => updateLine(l.key, { itemDesc: e.target.value })}
              />
              <div className="ml-2 flex items-center gap-2">
                {l.isCatalogued ? (
                  <Pill variant="success">catalogued</Pill>
                ) : (
                  <Pill variant="warn">free-text</Pill>
                )}
                <button
                  className="text-danger"
                  onClick={() => removeLine(l.key)}
                  aria-label="Remove"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              <Labelled label="Qty">
                <Input
                  value={l.qty}
                  onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                />
              </Labelled>
              <Labelled label="UOM">
                <Input
                  value={l.uom}
                  onChange={(e) => updateLine(l.key, { uom: e.target.value })}
                />
              </Labelled>
              <Labelled label="Unit price">
                <Input
                  value={l.unitPrice}
                  onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                />
              </Labelled>
              <Labelled label="Disc %">
                <Input
                  value={l.discountPct}
                  onChange={(e) => updateLine(l.key, { discountPct: e.target.value })}
                />
              </Labelled>
              <Labelled label="Tax %">
                <Input
                  value={l.taxRate}
                  onChange={(e) => updateLine(l.key, { taxRate: e.target.value })}
                />
              </Labelled>
              <Labelled label="HSN">
                <Input
                  value={l.hsnCode}
                  onChange={(e) => updateLine(l.key, { hsnCode: e.target.value })}
                />
              </Labelled>
            </div>
            <div className="text-muted mt-1 text-right text-[12px] tabular-nums">
              Line total {inr(String(lineTotal(l)))}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={addLine}>
            <Plus size={14} /> Add line
          </Button>
          <span className="text-ink text-[14px] font-semibold tabular-nums">
            PR total {inr(String(prTotal))}
          </span>
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/requisitions/${id}`)}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onSave} disabled={!valid || update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
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

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="text-faint mb-0.5 block text-[10px] uppercase">{label}</span>
      {children}
    </label>
  );
}
