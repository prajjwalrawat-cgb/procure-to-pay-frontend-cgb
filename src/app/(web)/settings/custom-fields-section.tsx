'use client';

import { Button, Input, Pill } from '@/components/ui';
import {
  CHOICE_FIELD_TYPES,
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_ENTITY_LABELS,
  CUSTOM_FIELD_TYPE_LABELS,
  CUSTOM_FIELD_TYPES,
  type CustomFieldCreateInput,
  type CustomFieldDefinition,
  type CustomFieldEntity,
  type CustomFieldType,
} from '@/lib/shared';
import { useState } from 'react';

import {
  useCreateCustomField,
  useCustomFields,
  useUpdateCustomField,
} from '@/lib/api/settings';
import { ApiError } from '@/lib/api-error';
import { useToastStore } from '@/store/toast-store';
import { Field, Panel, selectCls } from './ui';

/**
 * Custom fields. An admin adds a field to a document type here; every form for
 * that type then renders it, and printable fields appear on the PDF. No code
 * change and no migration — the fields a business needs on its own paperwork
 * cannot be enumerated up front.
 */
export function CustomFieldsSection(): React.JSX.Element {
  const { data, isLoading } = useCustomFields();
  const create = useCreateCustomField();
  const update = useUpdateCustomField();
  const toast = useToastStore((s) => s.push);

  const [entity, setEntity] = useState<CustomFieldEntity>('PURCHASE_ORDER');
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('TEXT');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);
  const [printable, setPrintable] = useState(false);
  const [helpText, setHelpText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isLoading || !data) {
    return <div className="text-body-sm text-muted">Loading…</div>;
  }

  const fields = data
    .filter((f) => f.entityType === entity)
    .sort((a, b) => a.orderNo - b.orderNo);

  const reset = (): void => {
    setLabel('');
    setFieldType('TEXT');
    setOptions('');
    setRequired(false);
    setPrintable(false);
    setHelpText('');
    setErrors({});
    setAdding(false);
  };

  const onAdd = (): void => {
    setErrors({});
    const body: CustomFieldCreateInput = {
      entityType: entity,
      label: label.trim(),
      fieldType,
      ...(CHOICE_FIELD_TYPES.includes(fieldType)
        ? {
            options: options
              .split('\n')
              .map((o) => o.trim())
              .filter(Boolean),
          }
        : {}),
      isRequired: required,
      isPrintable: printable,
      helpText: helpText.trim() ? helpText.trim() : null,
    };
    create.mutate(body, {
      onSuccess: () => {
        toast(
          `"${body.label}" added to ${CUSTOM_FIELD_ENTITY_LABELS[entity]}`,
          'success',
        );
        reset();
      },
      onError: (e) => {
        if (e instanceof ApiError) setErrors(e.fieldErrors);
        toast(e instanceof Error ? e.message : 'Could not add the field', 'error');
      },
    });
  };

  const toggle = (f: CustomFieldDefinition, patch: Record<string, boolean>): void =>
    update.mutate(
      { id: f.id, body: patch },
      {
        onError: (e) => toast(e instanceof Error ? e.message : 'Failed', 'error'),
      },
    );

  return (
    <Panel
      title="Custom fields"
      hint="Fields you add here appear on the matching form, on the document's detail page, and — when marked printable — on the purchase-order PDF."
      action={
        !adding ? (
          <Button size="sm" variant="default" onClick={() => setAdding(true)}>
            Add field
          </Button>
        ) : undefined
      }
    >
      <Field label="Document type">
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value as CustomFieldEntity)}
          className={selectCls}
        >
          {CUSTOM_FIELD_ENTITIES.map((e) => (
            <option key={e} value={e}>
              {CUSTOM_FIELD_ENTITY_LABELS[e]}
            </option>
          ))}
        </select>
      </Field>

      {fields.length === 0 ? (
        <p className="text-caption text-muted">
          No custom fields on {CUSTOM_FIELD_ENTITY_LABELS[entity].toLowerCase()}s yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-sm border border-line">
          <table className="w-full text-caption">
            <thead className="border-line border-b text-left text-caption text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-center font-medium">Required</th>
                <th className="px-3 py-2 text-center font-medium">On PDF</th>
                <th className="px-3 py-2 text-center font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <div className="text-text">{f.label}</div>
                    <div className="font-numeric text-micro text-faint">{f.key}</div>
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {CUSTOM_FIELD_TYPE_LABELS[f.fieldType]}
                    {f.options.length > 0 && (
                      <span className="text-faint"> {f.options.length} choices</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={f.isRequired}
                      onChange={(e) => toggle(f, { isRequired: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={f.isPrintable}
                      onChange={(e) => toggle(f, { isPrintable: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {f.isActive ? (
                      <button
                        type="button"
                        className="text-micro text-muted hover:text-danger"
                        onClick={() => toggle(f, { isActive: false })}
                      >
                        Retire
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <Pill variant="gray">Retired</Pill>
                        <button
                          type="button"
                          className="text-micro text-accent-2"
                          onClick={() => toggle(f, { isActive: true })}
                        >
                          Restore
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="mt-2 rounded-sm border border-line bg-canvas p-3">
          <div className="mb-2 text-body-sm font-medium text-ink">
            New field on {CUSTOM_FIELD_ENTITY_LABELS[entity].toLowerCase()}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Label" error={errors.label}>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                aria-invalid={!!errors.label}
                placeholder="e.g. Project code"
              />
            </Field>
            <Field label="Type">
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
                className={selectCls}
              >
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CUSTOM_FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {CHOICE_FIELD_TYPES.includes(fieldType) && (
            <div className="mt-3">
              <Field label="Choices" error={errors.options} hint="One per line." wide>
                <textarea
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  rows={3}
                  className="w-full rounded-sm border border-line bg-panel px-3 py-2 text-body-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  placeholder={'Capex\nOpex'}
                />
              </Field>
            </div>
          )}
          <div className="mt-3">
            <Field label="Help text" error={errors.helpText} wide>
              <Input
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Shown under the field on the form"
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-caption">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
              />
              <span className="text-muted">Required</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={printable}
                onChange={(e) => setPrintable(e.target.checked)}
              />
              <span className="text-muted">Print on the PDF</span>
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={create.isPending || !label.trim()}
              onClick={onAdd}
            >
              {create.isPending ? 'Adding…' : 'Add field'}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
