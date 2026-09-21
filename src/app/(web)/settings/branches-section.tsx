'use client';

import { Badge, Button, Input, Pill } from '@/components/ui';
import { SELECTABLE_GST_STATES, type Branch, type BranchInput } from '@/lib/shared';
import { useState } from 'react';

import {
  useCreateBranch,
  useOrganisationSettings,
  useSetDefaultBranch,
  useUpdateBranch,
} from '@/lib/api/settings';
import { ApiError } from '@/lib/api-error';
import { useToastStore } from '@/store/toast-store';
import { Field, Panel, SectionLoading, selectCls, textareaCls } from './ui';

const EMPTY: BranchInput = {
  name: '',
  address: '',
  stateCode: '',
  gstin: '',
  isDefault: false,
};

/**
 * GST registrations. One row per state a tenant is registered in — an entity
 * registered in two states holds two GSTINs, and a purchase order is always
 * raised in the name of exactly one of them. The default is what a document
 * bills to when it names none.
 */
export function BranchesSection(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useOrganisationSettings();
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const setDefault = useSetDefaultBranch();
  const toast = useToastStore((s) => s.push);

  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<BranchInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isLoading || !data) {
    return <SectionLoading error={error} onRetry={() => void refetch()} />;
  }

  const startNew = (): void => {
    setForm(EMPTY);
    setErrors({});
    setEditing('new');
  };

  const startEdit = (b: Branch): void => {
    setForm({
      name: b.name,
      address: b.address ?? '',
      stateCode: b.stateCode,
      gstin: b.gstin ?? '',
      isDefault: b.isDefault,
    });
    setErrors({});
    setEditing(b.id);
  };

  const onSave = (): void => {
    setErrors({});
    const body: BranchInput = {
      name: form.name.trim(),
      address: form.address?.trim() ? form.address.trim() : null,
      stateCode: form.stateCode,
      gstin: form.gstin?.trim() ? form.gstin.trim().toUpperCase() : null,
      isDefault: form.isDefault,
    };
    const onError = (e: unknown): void => {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      toast(e instanceof Error ? e.message : 'Could not save the branch', 'error');
    };
    if (editing === 'new') {
      create.mutate(body, {
        onSuccess: () => {
          toast('Registration added', 'success');
          setEditing(null);
        },
        onError,
      });
    } else if (editing) {
      update.mutate(
        { id: editing, body },
        {
          onSuccess: () => {
            toast('Registration updated', 'success');
            setEditing(null);
          },
          onError,
        },
      );
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Panel
      title="GST registrations"
      hint="One branch per state you are registered in. The default is used when an order does not name a registration — it decides the GSTIN printed on the PO, the place of supply (CGST+SGST vs IGST) and the jurisdiction clause."
      action={
        editing === null ? (
          <Button size="sm" variant="secondary" onClick={startNew}>
            Add registration
          </Button>
        ) : undefined
      }
    >
      {data.branches.length === 0 && editing === null && (
        <p className="text-caption text-muted">
          No registrations yet. Add the branch that raises purchase orders.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {data.branches.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-body-sm font-medium text-text">{b.name}</span>
                {b.isDefault && <Badge variant="classification">Default</Badge>}
              </div>
              <div className="font-numeric truncate text-micro text-muted">
                {b.gstin ?? 'No GSTIN'} ·{' '}
                {SELECTABLE_GST_STATES.find((s) => s.code === b.stateCode)?.name ??
                  b.stateCode}
                {b.address ? ` · ${b.address}` : ''}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!b.isDefault && (
                <button
                  type="button"
                  className="text-caption text-muted hover:text-text"
                  disabled={setDefault.isPending}
                  onClick={() =>
                    setDefault.mutate(b.id, {
                      onSuccess: () => toast(`${b.name} is now the default`, 'success'),
                      onError: (e) =>
                        toast(e instanceof Error ? e.message : 'Failed', 'error'),
                    })
                  }
                >
                  Make default
                </button>
              )}
              <button
                type="button"
                className="text-caption font-medium text-accent-2"
                onClick={() => startEdit(b)}
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing !== null && (
        <div className="mt-2 rounded-sm border border-line bg-canvas p-3">
          <div className="mb-2 text-body-sm font-medium text-ink">
            {editing === 'new' ? 'New registration' : 'Edit registration'}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Branch name" error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={!!errors.name}
                placeholder="e.g. Delhi HQ"
              />
            </Field>
            <Field label="State" error={errors.stateCode}>
              <select
                value={form.stateCode}
                onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
                className={selectCls}
              >
                <option value="">Select a state…</option>
                {SELECTABLE_GST_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Field
              label="GSTIN"
              error={errors.gstin}
              hint="The registration number for this state."
            >
              <Input
                value={form.gstin ?? ''}
                onChange={(e) =>
                  setForm({ ...form, gstin: e.target.value.toUpperCase() })
                }
                aria-invalid={!!errors.gstin}
                maxLength={15}
                placeholder="15-character GSTIN"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Address" error={errors.address} wide>
              <textarea
                value={form.address ?? ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                className={textareaCls}
                placeholder="Printed as the bill-to address on the PO"
              />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-caption">
            <input
              type="checkbox"
              checked={!!form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            <span className="text-muted">Use as the default registration</span>
          </label>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="primary" disabled={pending} onClick={onSave}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
