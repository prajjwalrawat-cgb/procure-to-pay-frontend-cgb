'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pill,
  Skeleton,
  Textarea,
  controlClass,
} from '@/components/ui';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { RequisitionLineInput, RequisitionUpdateInput } from '@/lib/shared';

import { useCostCenters, usePlants } from '@/lib/api/refs';
import { useRequisition, useUpdateRequisition } from '@/lib/api/requisitions';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { percentToRate, rateToPercent } from '@/lib/rate';
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
  const { data, isLoading, error, refetch } = useRequisition(id);
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
        // The API sends fractions; the "Disc %" / "Tax %" inputs show percentages.
        discountPct: rateToPercent(l.discountPct),
        taxRate: rateToPercent(l.taxRate),
        hsnCode: l.hsnCode ?? '',
        preferredVendorId: l.preferredVendor?.id ?? null,
        reasonCode: l.reasonCode,
        isCatalogued: l.isCatalogued,
      })),
    );
    setHydrated(true);
  }, [data, hydrated]);

  if (isLoading) {
    return (
      <div aria-busy="true" className="mx-auto w-full max-w-4xl">
        <Skeleton className="mb-4 h-3 w-32" />
        <Skeleton className="mb-6 h-6 w-56" />
        <Skeleton className="mb-4 h-72 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  // DRAFT-only guard (backend enforces this too).
  if (data.status !== 'DRAFT') {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <EmptyState
          title="This requisition can't be edited"
          detail={
            <>
              Only drafts are editable — {data.number} is{' '}
              <Pill variant={statusVariant(data.status)}>{statusLabel(data.status)}</Pill>.
            </>
          }
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href={`/requisitions/${id}`}>Back to {data.number}</Link>
            </Button>
          }
        />
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
        taxRate: '18',
        hsnCode: '',
        preferredVendorId: null,
        reasonCode: 'OTHER',
        isCatalogued: false,
      },
    ]);

  const num = (s: string): number => Number(s) || 0;
  const lineTotal = (l: EditLine): number =>
    num(l.qty) *
    num(l.unitPrice) *
    (1 - num(l.discountPct) / 100) *
    (1 + num(l.taxRate) / 100);
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
        discountPct: percentToRate(l.discountPct),
        taxRate: percentToRate(l.taxRate),
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
    <div className="mx-auto w-full max-w-4xl pb-8">
      <Link
        href={`/requisitions/${id}`}
        className="text-muted hover:text-text mb-3 inline-flex items-center gap-1 text-caption"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to {data.number}
      </Link>
      <PageHeader
        title={`Edit ${data.number}`}
        numeric
        meta={
          <Pill variant={statusVariant(data.status)} dot>
            {statusLabel(data.status)}
          </Pill>
        }
        description={data.title}
      />

      <Section title="Basics">
        <Field label="Title" hint="Minimum 5 characters">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Field label="Cost centre">
            <select
              className={controlClass}
              value={costCenterId}
              onChange={(e) => setCostCenterId(e.target.value)}
            >
              {costCenters?.items.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.code}, {cc.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch / GST registration">
            <select
              className={controlClass}
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
              className={controlClass}
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
            />
          </Field>
          <Field label="Priority">
            <select
              className={controlClass}
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
        <Field label="Business justification" hint="Minimum 20 characters">
          <Textarea
            rows={3}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Line items">
        {lines.length === 0 && (
          <p className="text-muted mb-3 text-caption">
            A requisition needs at least one line — add one below.
          </p>
        )}
        {lines.map((l, i) => (
          <div key={l.key} className="border-line bg-canvas/40 mb-3 rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Input
                className="min-w-0 flex-1"
                placeholder="Item description"
                aria-label={`Line ${i + 1} description`}
                value={l.itemDesc}
                onChange={(e) => updateLine(l.key, { itemDesc: e.target.value })}
              />
              <div className="flex shrink-0 items-center gap-2">
                {l.isCatalogued ? (
                  <Pill variant="neutral">Catalogued</Pill>
                ) : (
                  <Pill variant="warn">Non-catalogued</Pill>
                )}
                <button
                  type="button"
                  className="text-muted hover:text-danger rounded-sm p-1"
                  onClick={() => removeLine(l.key)}
                  aria-label={`Remove line ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
              <Labelled label="Qty">
                <Input
                  inputMode="decimal"
                  value={l.qty}
                  onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                />
              </Labelled>
              <Labelled label="UoM">
                <Input
                  value={l.uom}
                  onChange={(e) => updateLine(l.key, { uom: e.target.value })}
                />
              </Labelled>
              <Labelled label="Unit price">
                <Input
                  inputMode="decimal"
                  value={l.unitPrice}
                  onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                />
              </Labelled>
              <Labelled label="Disc %">
                <Input
                  inputMode="decimal"
                  value={l.discountPct}
                  onChange={(e) => updateLine(l.key, { discountPct: e.target.value })}
                />
              </Labelled>
              <Labelled label="Tax %">
                <Input
                  inputMode="decimal"
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
            <div className="font-numeric text-ink mt-2 text-right text-body-sm font-semibold">
              {inr(lineTotal(l).toFixed(2))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add line
          </Button>
          <span className="font-numeric text-ink text-body font-semibold">
            PR total {inr(prTotal.toFixed(2))}
          </span>
        </div>
      </Section>

      {/* Say what is missing rather than leave a silently disabled button. */}
      {!valid && (
        <p className="text-muted mb-3 text-caption">
          To save: a title of 5+ characters, a justification of 20+ characters, and at least one
          line — each with a description and a quantity above zero.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
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
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

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
    <label className="mb-3 block">
      <span className="text-muted mb-1 flex items-center gap-2 text-caption font-medium">
        {label}
        {hint && <span className="text-faint text-micro font-normal">{hint}</span>}
      </span>
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
      <span className="text-faint mb-0.5 block text-micro">{label}</span>
      {children}
    </label>
  );
}
