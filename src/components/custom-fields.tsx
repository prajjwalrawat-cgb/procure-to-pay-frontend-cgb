'use client';

import { Input } from '@/components/ui';
import {
  formatCustomFieldValue,
  type CustomFieldDefinition,
  type CustomFieldEntity,
  type CustomFieldValues,
} from '@/lib/shared';

import { useFormFields } from '@/lib/api/settings';

/**
 * Renders the admin-defined fields for a document type.
 *
 * The field list is tenant data fetched at render time, so a field added in
 * Settings shows up on the form without a deploy. Renders nothing at all when
 * the tenant has defined none, which is the common case — the section must not
 * take up space it hasn't earned.
 */
export function CustomFieldInputs({
  entity,
  values,
  onChange,
  errors,
}: {
  entity: CustomFieldEntity;
  values: CustomFieldValues;
  onChange: (next: CustomFieldValues) => void;
  errors?: Record<string, string>;
}): React.JSX.Element | null {
  const { data: defs } = useFormFields(entity);
  if (!defs || defs.length === 0) return null;

  const set = (key: string, value: unknown): void =>
    onChange({ ...values, [key]: value });

  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-3 text-body font-semibold text-ink">Additional details</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {defs.map((def) => (
          <CustomFieldInput
            key={def.id}
            def={def}
            value={values[def.key]}
            error={errors?.[def.key]}
            onChange={(v) => set(def.key, v)}
          />
        ))}
      </div>
    </section>
  );
}

function CustomFieldInput({
  def,
  value,
  error,
  onChange,
}: {
  def: CustomFieldDefinition;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}): React.JSX.Element {
  const inputCls =
    'border-line bg-panel text-text focus-visible:ring-accent h-9 w-full rounded-sm border px-3 text-body-sm outline-none focus-visible:ring-2';

  const control = (): React.JSX.Element => {
    switch (def.fieldType) {
      case 'TEXTAREA':
        return (
          <textarea
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            className="w-full rounded-sm border border-line bg-panel px-3 py-2 text-body-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        );
      case 'NUMBER':
        return (
          <Input
            type="number"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
          />
        );
      case 'DATE':
        return (
          <Input
            type="date"
            value={String(value ?? '').slice(0, 10)}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
          />
        );
      case 'CHECKBOX':
        return (
          <label className="flex h-9 items-center gap-2 text-body-sm">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="text-muted">{def.helpText ?? 'Yes'}</span>
          </label>
        );
      case 'SELECT':
        return (
          <select
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {def.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      case 'MULTI_SELECT': {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="flex flex-wrap gap-2 py-1">
            {def.options.map((o) => (
              <label key={o} className="flex items-center gap-1.5 text-caption">
                <input
                  type="checkbox"
                  checked={selected.includes(o)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, o]
                        : selected.filter((s) => s !== o),
                    )
                  }
                />
                <span className="text-muted">{o}</span>
              </label>
            ))}
          </div>
        );
      }
      default:
        return (
          <Input
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
          />
        );
    }
  };

  return (
    <label className="block">
      <span className="mb-1 block text-caption text-muted">
        {def.label}
        {def.isRequired && <span className="text-danger"> *</span>}
      </span>
      {control()}
      {def.helpText && def.fieldType !== 'CHECKBOX' && !error && (
        <span className="mt-1 block text-micro text-faint">{def.helpText}</span>
      )}
      {error && <span className="mt-1 block text-micro text-danger">{error}</span>}
    </label>
  );
}

/** Read-only view of captured values, for detail pages. */
export function CustomFieldList({
  entity,
  values,
}: {
  entity: CustomFieldEntity;
  values: CustomFieldValues | null | undefined;
}): React.JSX.Element | null {
  const { data: defs } = useFormFields(entity);
  if (!defs || !values) return null;
  const rows = defs.filter((d) => {
    const v = values[d.key];
    return v !== undefined && v !== null && v !== '';
  });
  if (rows.length === 0) return null;

  return (
    <dl className="flex flex-col gap-1 text-caption">
      {rows.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-3">
          <dt className="text-muted">{d.label}</dt>
          <dd className="text-right text-text">
            {formatCustomFieldValue(d, values[d.key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
