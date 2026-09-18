'use client';

import { Button, Pill } from '@/components/ui';
import {
  ItemCreateInputSchema,
  type ItemCreateInput,
  type ItemDetailResponse,
} from '@/lib/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ApiError, zodFieldErrors, zodSummary } from '@/lib/api-error';
import {
  useCreateItem,
  useDeactivateItem,
  useItem,
  useUpdateItem,
} from '@/lib/api/items';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';
import { Field, SelectInput, TextArea, TextInput } from './form-controls';

/**
 * `Item.gstRate` is a *fraction* on the wire and in the database — the Slice 4
 * seed writes '0.18' and `computeLineTax` multiplies the subtotal by it
 * directly. Buyers think in percentages, so the form trades in slabs and stores
 * the fraction; the raw number is never typed by hand.
 */
const GST_SLABS: { value: string; label: string }[] = [
  { value: '0', label: '0% — exempt / nil rated' },
  { value: '0.05', label: '5%' },
  { value: '0.12', label: '12%' },
  { value: '0.18', label: '18%' },
  { value: '0.28', label: '28%' },
];

export type ItemDrawerTarget = { mode: 'create' } | { mode: 'edit'; id: string };

interface FormState {
  skuCode: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  hsnCode: string;
  gstRate: string;
  primaryUom: string;
  isCapex: boolean;
  defaultGlAccount: string;
  uomConversions: { key: string; fromUom: string; toUom: string; factor: string }[];
}

const BLANK: FormState = {
  skuCode: '',
  name: '',
  description: '',
  category: '',
  subcategory: '',
  hsnCode: '',
  gstRate: '0.18',
  primaryUom: 'NOS',
  isCapex: false,
  defaultGlAccount: '',
  uomConversions: [],
};

let convSeq = 0;

function fromDetail(d: ItemDetailResponse): FormState {
  return {
    skuCode: d.skuCode,
    name: d.name,
    description: d.description ?? '',
    category: d.category,
    subcategory: d.subcategory ?? '',
    hsnCode: d.hsnCode,
    gstRate: d.gstRate,
    primaryUom: d.primaryUom,
    isCapex: d.isCapex,
    defaultGlAccount: d.defaultGlAccount ?? '',
    uomConversions: d.uomConversions.map((c) => ({
      key: `c${(convSeq += 1)}`,
      ...c,
    })),
  };
}

function toPayload(f: FormState): ItemCreateInput {
  return {
    skuCode: f.skuCode.trim(),
    name: f.name.trim(),
    description: f.description.trim() || null,
    category: f.category.trim(),
    subcategory: f.subcategory.trim() || null,
    hsnCode: f.hsnCode.trim(),
    gstRate: f.gstRate,
    primaryUom: f.primaryUom.trim(),
    isCapex: f.isCapex,
    defaultGlAccount: f.defaultGlAccount.trim() || null,
    uomConversions: f.uomConversions
      .filter((c) => c.fromUom.trim() && c.toUom.trim() && c.factor.trim())
      .map((c) => ({
        fromUom: c.fromUom.trim(),
        toUom: c.toUom.trim(),
        factor: c.factor.trim(),
      })),
  };
}

export function ItemDrawer({
  target,
  canManage,
  onClose,
}: {
  target: ItemDrawerTarget | null;
  canManage: boolean;
  onClose: () => void;
}): React.JSX.Element | null {
  if (!target) return null;
  return <Drawer target={target} canManage={canManage} onClose={onClose} />;
}

function Drawer({
  target,
  canManage,
  onClose,
}: {
  target: ItemDrawerTarget;
  canManage: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const editingId = target.mode === 'edit' ? target.id : null;
  const { data, isLoading } = useItem(editingId);

  return (
    <>
      <button
        type="button"
        aria-label="Close item"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/20"
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-panel shadow-xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-panel px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold tracking-heading text-ink">
              {target.mode === 'create' ? 'New item' : (data?.name ?? 'Loading…')}
            </h2>
            <p className="font-numeric text-[12px] text-muted">
              {target.mode === 'create'
                ? 'Adds a SKU to the catalogue used by requisition lines'
                : (data?.skuCode ?? '')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {data && !data.isActive && <Pill variant="danger">Inactive</Pill>}
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] text-muted hover:text-ink"
            >
              Close
            </button>
          </div>
        </header>

        {target.mode === 'edit' && isLoading && (
          <p className="px-5 py-8 text-[13px] text-muted">Loading…</p>
        )}
        {target.mode === 'create' && (
          <ItemForm
            itemId={null}
            initial={BLANK}
            readOnly={!canManage}
            detail={null}
            onDone={onClose}
          />
        )}
        {target.mode === 'edit' && data && (
          <ItemForm
            key={data.id}
            itemId={data.id}
            initial={fromDetail(data)}
            readOnly={!canManage}
            detail={data}
            onDone={onClose}
          />
        )}
      </aside>
    </>
  );
}

function ItemForm({
  itemId,
  initial,
  readOnly,
  detail,
  onDone,
}: {
  itemId: string | null;
  initial: FormState;
  readOnly: boolean;
  detail: ItemDetailResponse | null;
  onDone: () => void;
}): React.JSX.Element {
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const push = useToastStore((s) => s.push);

  // Both mutations are always constructed; only the one matching the mode fires.
  const create = useCreateItem();
  const update = useUpdateItem(itemId ?? '');
  const deactivate = useDeactivateItem(itemId ?? '');
  const busy = create.isPending || update.isPending || deactivate.isPending;

  const set = (patch: Partial<FormState>): void => setForm((f) => ({ ...f, ...patch }));
  const setConv = (key: string, patch: Partial<FormState['uomConversions'][0]>): void =>
    setForm((f) => ({
      ...f,
      uomConversions: f.uomConversions.map((c) =>
        c.key === key ? { ...c, ...patch } : c,
      ),
    }));

  // An item saved before these slabs existed (or via the API) may sit on a rate
  // the dropdown does not list — surface it rather than silently re-rating it.
  const slabs = GST_SLABS.some((s) => s.value === form.gstRate)
    ? GST_SLABS
    : [...GST_SLABS, { value: form.gstRate, label: `${form.gstRate} (custom)` }];

  const submit = async (): Promise<void> => {
    const payload = toPayload(form);
    const parsed = ItemCreateInputSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      push(zodSummary(parsed.error, 'Check the highlighted fields'), 'error');
      return;
    }
    setErrors({});
    try {
      if (itemId === null) {
        await create.mutateAsync(payload);
        push(`${payload.skuCode} added to the catalogue`, 'success');
      } else {
        // PATCH /items/:id does not accept uomConversions — they are create-only.
        const { uomConversions: _conversions, ...rest } = payload;
        await update.mutateAsync(rest);
        push(`${payload.skuCode} updated`, 'success');
      }
      onDone();
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        push(e.message, 'error');
      } else {
        push(e instanceof Error ? e.message : 'Save failed', 'error');
      }
    }
  };

  const onDeactivate = async (): Promise<void> => {
    if (!itemId) return;
    try {
      await deactivate.mutateAsync();
      push(`${form.skuCode} deactivated`, 'success');
      onDone();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Deactivate failed', 'error');
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="SKU code"
            required
            error={errors.skuCode}
            hint={
              itemId
                ? 'Fixed once created — PR and PO lines snapshot this code.'
                : 'Unique within the tenant, e.g. IT-RAM-DDR4-8'
            }
          >
            <TextInput
              value={form.skuCode}
              // PATCH /items/:id ignores skuCode, so an editable box here would
              // silently discard the change.
              disabled={readOnly || itemId !== null}
              invalid={Boolean(errors.skuCode)}
              onChange={(e) => set({ skuCode: e.target.value })}
              placeholder="IT-RAM-DDR4-8"
            />
          </Field>
          <Field label="Name" required error={errors.name}>
            <TextInput
              value={form.name}
              disabled={readOnly}
              invalid={Boolean(errors.name)}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="RAM DDR4 8GB"
            />
          </Field>
        </div>

        <Field
          label="Description"
          error={errors.description}
          hint="Searched alongside SKU and name in the requisition picker"
        >
          <TextArea
            value={form.description}
            disabled={readOnly}
            invalid={Boolean(errors.description)}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" required error={errors.category}>
            <TextInput
              value={form.category}
              disabled={readOnly}
              invalid={Boolean(errors.category)}
              onChange={(e) => set({ category: e.target.value })}
              placeholder="IT Hardware"
            />
          </Field>
          <Field label="Sub-category" error={errors.subcategory}>
            <TextInput
              value={form.subcategory}
              disabled={readOnly}
              invalid={Boolean(errors.subcategory)}
              onChange={(e) => set({ subcategory: e.target.value })}
              placeholder="Memory"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="HSN code" required error={errors.hsnCode} hint="2–12 digits">
            <TextInput
              value={form.hsnCode}
              disabled={readOnly}
              invalid={Boolean(errors.hsnCode)}
              onChange={(e) => set({ hsnCode: e.target.value })}
              placeholder="8473"
            />
          </Field>
          <Field label="GST rate" required error={errors.gstRate}>
            <SelectInput
              value={form.gstRate}
              disabled={readOnly}
              invalid={Boolean(errors.gstRate)}
              onChange={(e) => set({ gstRate: e.target.value })}
            >
              {slabs.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field
            label="Primary UoM"
            required
            error={errors.primaryUom}
            hint="Defaults the PR line"
          >
            <TextInput
              value={form.primaryUom}
              disabled={readOnly}
              invalid={Boolean(errors.primaryUom)}
              onChange={(e) => set({ primaryUom: e.target.value })}
              placeholder="NOS"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default GL account" error={errors.defaultGlAccount}>
            <TextInput
              value={form.defaultGlAccount}
              disabled={readOnly}
              invalid={Boolean(errors.defaultGlAccount)}
              onChange={(e) => set({ defaultGlAccount: e.target.value })}
              placeholder="5100-CONSUMABLES"
            />
          </Field>
          <label className="mt-6 flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={form.isCapex}
              disabled={readOnly}
              onChange={(e) => set({ isCapex: e.target.checked })}
            />
            <span className="text-text">Capital expenditure (CAPEX)</span>
          </label>
        </div>

        {/* ── UoM conversions ── */}
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-faint">
              UoM conversions
            </span>
            {!readOnly && itemId === null && (
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    uomConversions: [
                      ...f.uomConversions,
                      { key: `c${(convSeq += 1)}`, fromUom: '', toUom: '', factor: '' },
                    ],
                  }))
                }
                className="flex items-center gap-1 text-[12px] font-medium text-accent-2"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            )}
          </div>
          <p className="mb-2 text-[11px] text-faint">
            Used when goods are received in a different unit from the PO. Without a
            conversion the GRN treats the two units as 1:1.
          </p>
          {form.uomConversions.length === 0 && (
            <p className="text-[12px] text-muted">None.</p>
          )}
          {form.uomConversions.map((c) => (
            <div key={c.key} className="mb-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <TextInput
                value={c.fromUom}
                disabled={readOnly || itemId !== null}
                onChange={(e) => setConv(c.key, { fromUom: e.target.value })}
                placeholder="From (box)"
              />
              <TextInput
                value={c.toUom}
                disabled={readOnly || itemId !== null}
                onChange={(e) => setConv(c.key, { toUom: e.target.value })}
                placeholder="To (NOS)"
              />
              <TextInput
                value={c.factor}
                disabled={readOnly || itemId !== null}
                inputMode="decimal"
                onChange={(e) => setConv(c.key, { factor: e.target.value })}
                placeholder="Factor"
              />
              {!readOnly && itemId === null ? (
                <button
                  type="button"
                  aria-label="Remove conversion"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      uomConversions: f.uomConversions.filter((x) => x.key !== c.key),
                    }))
                  }
                  className="px-1 text-faint hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          {itemId !== null && form.uomConversions.length > 0 && (
            <p className="mt-1 text-[11px] text-faint">
              Conversions are set at creation time and cannot be edited here.
            </p>
          )}
        </div>

        {/* ── Vendor pricing (read-only; maintained by sourcing/contracts) ── */}
        {detail && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-[11px] font-semibold text-faint">
              Vendor pricing
            </div>
            {detail.vendorPricing.length === 0 ? (
              <p className="text-[12px] text-muted">
                No vendor prices yet — the requisition picker will show no preferred
                vendor or last-paid price for this item.
              </p>
            ) : (
              <table className="w-full text-[12px]">
                <tbody>
                  {detail.vendorPricing.map((p) => (
                    <tr key={p.id} className="border-t border-line first:border-t-0">
                      <td className="py-1.5">
                        {p.vendorName}
                        {p.isPreferred && (
                          <span className="ml-1.5">
                            <Pill variant="success">preferred</Pill>
                          </span>
                        )}
                      </td>
                      <td className="font-numeric py-1.5 text-right">
                        {inr(p.unitPrice)} / {p.uom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {!readOnly && (
        <footer className="sticky bottom-0 mt-auto flex items-center justify-between gap-2 border-t border-line bg-panel px-5 py-3">
          {itemId !== null && detail?.isActive ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onDeactivate}>
              Deactivate
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" disabled={busy} onClick={onDone}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={busy} onClick={submit}>
              {busy ? 'Saving…' : itemId === null ? 'Create item' : 'Save changes'}
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
