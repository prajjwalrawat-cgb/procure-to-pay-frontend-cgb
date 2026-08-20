'use client';

import { Button, Input, Pill } from '@/components/ui';
import {
  ONBOARDING_MANDATORY_DOCUMENTS,
  ONBOARDING_OPTIONAL_DOCUMENTS,
  VENDOR_DOCUMENT_TYPE,
  vendorDocumentLabel,
  type VendorCategory,
  type VendorCategoryCreateInput,
  type VendorCategoryUpdateInput,
  type VendorDocumentType,
} from '@/lib/shared';
import { useState } from 'react';

import { ApiError } from '@/lib/api-error';
import {
  useCreateVendorCategory,
  useUpdateVendorCategory,
  useVendorCategories,
} from '@/lib/api/settings';
import { useToastStore } from '@/store/toast-store';
import { Field, Panel } from './ui';

/**
 * Documents the wizard already handles for every vendor, so ticking them per
 * category would change nothing: the mandatory four that gate submission, and
 * the catalogue, which is offered to everyone and deliberately never required.
 * `OTHER` is a filing bucket, not a document anyone can be asked for.
 */
const ALWAYS_ASKED: VendorDocumentType[] = ONBOARDING_MANDATORY_DOCUMENTS;
const CHOOSABLE_DOCUMENTS = VENDOR_DOCUMENT_TYPE.filter(
  (d) =>
    !ALWAYS_ASKED.includes(d) &&
    !ONBOARDING_OPTIONAL_DOCUMENTS.includes(d) &&
    d !== 'OTHER',
);

/** Nothing beyond the statutory minimum, until an admin says otherwise. */
const EMPTY_FORM = {
  displayName: '',
  description: '',
  slaHours: '120',
  extraDocuments: [] as VendorDocumentType[],
};

/**
 * Vendor categories. The list a vendor is filed under is this organisation's
 * own — a reseller/OEM distributor and a cement plant classify differently — so
 * it is maintained here rather than fixed in code. What is set here is what the
 * invite dialog, the public self-registration form and the onboarding wizard
 * offer.
 *
 * A category is retired, never deleted: vendors, onboardings and scorecards
 * already point at it, and they keep reading correctly once it stops being
 * offered to new ones.
 */
export function VendorCategoriesSection(): React.JSX.Element {
  const { data, isLoading } = useVendorCategories();
  const create = useCreateVendorCategory();
  const update = useUpdateVendorCategory();
  const toast = useToastStore((s) => s.push);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isLoading || !data) {
    return <div className="text-[13px] text-muted">Loading…</div>;
  }

  const active = data.filter((c) => c.isActive);

  const reset = (): void => {
    setForm(EMPTY_FORM);
    setErrors({});
    setAdding(false);
    setEditingId(null);
  };

  const startEdit = (c: VendorCategory): void => {
    setAdding(false);
    setEditingId(c.id);
    setErrors({});
    setForm({
      displayName: c.displayName,
      description: c.description ?? '',
      slaHours: String(c.slaHours),
      extraDocuments: c.requiredDocuments.filter((d) => !ALWAYS_ASKED.includes(d)),
    });
  };

  const toggleDoc = (doc: VendorDocumentType): void =>
    setForm((f) => ({
      ...f,
      extraDocuments: f.extraDocuments.includes(doc)
        ? f.extraDocuments.filter((d) => d !== doc)
        : [...f.extraDocuments, doc],
    }));

  const onError = (e: unknown): void => {
    if (e instanceof ApiError) setErrors(e.fieldErrors);
    toast(e instanceof Error ? e.message : 'Could not save the category', 'error');
  };

  const onAdd = (): void => {
    setErrors({});
    const body: VendorCategoryCreateInput = {
      displayName: form.displayName.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      slaHours: Number(form.slaHours) || 120,
      requiredDocuments: [...ALWAYS_ASKED, ...form.extraDocuments],
    };
    create.mutate(body, {
      onSuccess: () => {
        toast(`"${body.displayName}" added`, 'success');
        reset();
      },
      onError,
    });
  };

  const onSaveEdit = (id: string): void => {
    setErrors({});
    const body: VendorCategoryUpdateInput = {
      displayName: form.displayName.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      slaHours: Number(form.slaHours) || 120,
      requiredDocuments: [...ALWAYS_ASKED, ...form.extraDocuments],
    };
    update.mutate(
      { id, body },
      {
        onSuccess: () => {
          toast('Category saved', 'success');
          reset();
        },
        onError,
      },
    );
  };

  const setActive = (c: VendorCategory, isActive: boolean): void =>
    update.mutate(
      { id: c.id, body: { isActive } },
      {
        onSuccess: () =>
          toast(
            isActive
              ? `"${c.displayName}" is offered again`
              : `"${c.displayName}" retired`,
            'success',
          ),
        onError: (e) =>
          toast(e instanceof Error ? e.message : 'Could not update', 'error'),
      },
    );

  const editor = (mode: 'add' | 'edit', id?: string): React.JSX.Element => (
    <div className="mt-2 rounded-sm border border-line bg-canvas p-3">
      <div className="mb-2 text-[13px] font-medium text-ink">
        {mode === 'add' ? 'New vendor category' : 'Edit category'}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name" error={errors.displayName}>
          <Input
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            aria-invalid={!!errors.displayName}
            placeholder="e.g. Reseller"
          />
        </Field>
        <Field
          label="Review SLA (hours)"
          error={errors.slaHours}
          hint="How long the onboarding review is given before it counts as overdue."
        >
          <Input
            value={form.slaHours}
            inputMode="numeric"
            onChange={(e) =>
              setForm({ ...form, slaHours: e.target.value.replace(/[^0-9]/g, '') })
            }
            aria-invalid={!!errors.slaHours}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Description" error={errors.description}>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What this category covers — shown to reviewers"
          />
        </Field>
      </div>
      <div className="mt-3">
        <div className="mb-1 text-[12px] text-muted">Documents to ask for</div>
        <p className="mb-2 text-[11px] text-faint">
          GST certificate, PAN card, cancelled cheque and audited financials are already
          collected from every vendor, whatever their category. Anything ticked here is
          additionally suggested to vendors in this category, and once it is on file
          keeping it valid is expected of them.
        </p>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2 md:grid-cols-3">
          {CHOOSABLE_DOCUMENTS.map((doc) => (
            <label key={doc} className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={form.extraDocuments.includes(doc)}
                onChange={() => toggleDoc(doc)}
              />
              <span className="capitalize text-muted">{vendorDocumentLabel(doc)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="accent"
          disabled={create.isPending || update.isPending || !form.displayName.trim()}
          onClick={() => (mode === 'add' ? onAdd() : onSaveEdit(id as string))}
        >
          {create.isPending || update.isPending
            ? 'Saving…'
            : mode === 'add'
              ? 'Add category'
              : 'Save'}
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <Panel
      title="Vendor categories"
      hint="The categories vendors are filed under. They fill the category dropdown on the invite dialog, the self-registration form and the onboarding wizard."
      action={
        !adding && !editingId ? (
          <Button size="sm" variant="default" onClick={() => setAdding(true)}>
            Add category
          </Button>
        ) : undefined
      }
    >
      <div className="overflow-hidden rounded-sm border border-line">
        <table className="w-full text-[12px]">
          <thead className="bg-canvas text-left text-[10px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Documents</th>
              <th className="px-3 py-2 font-medium">SLA</th>
              <th className="px-3 py-2 text-right font-medium">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={c.isActive ? 'text-text' : 'text-faint'}>
                      {c.displayName}
                    </span>
                    {!c.isActive && <Pill variant="gray">Retired</Pill>}
                  </div>
                  {c.description && (
                    <div className="text-[11px] text-faint">{c.description}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-muted">{c.requiredDocuments.length}</td>
                <td className="px-3 py-2 text-muted">{c.slaHours}h</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-[11px] text-accent-2"
                    onClick={() => startEdit(c)}
                  >
                    Edit
                  </button>
                  <span className="px-1 text-faint">·</span>
                  {c.isActive ? (
                    <button
                      type="button"
                      className="text-[11px] text-muted hover:text-danger"
                      onClick={() => setActive(c, false)}
                      disabled={active.length <= 1}
                      title={
                        active.length <= 1
                          ? 'Keep at least one category — vendors are filed under one when invited.'
                          : undefined
                      }
                    >
                      Retire
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-[11px] text-accent-2"
                      onClick={() => setActive(c, true)}
                    >
                      Restore
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && editor('add')}
      {editingId && editor('edit', editingId)}
    </Panel>
  );
}
