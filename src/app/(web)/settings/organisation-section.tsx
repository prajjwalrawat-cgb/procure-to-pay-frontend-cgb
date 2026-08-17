'use client';

import { Button, Input } from '@/components/ui';
import type { OrganisationUpdateInput } from '@/lib/shared';
import { useEffect, useState } from 'react';

import { useOrganisationSettings, useUpdateOrganisation } from '@/lib/api/settings';
import { ApiError } from '@/lib/api-error';
import { useToastStore } from '@/store/toast-store';
import { Field, Panel } from './ui';

/** Legal identity: the name on every purchase order and across the app. */
export function OrganisationSection(): React.JSX.Element {
  const { data, isLoading } = useOrganisationSettings();
  const update = useUpdateOrganisation();
  const toast = useToastStore((s) => s.push);

  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setName(data.tenant.name);
    setGstin(data.tenant.gstin ?? '');
    setCurrency(data.tenant.currency);
  }, [data]);

  if (isLoading || !data) {
    return <div className="text-[13px] text-muted">Loading…</div>;
  }

  const onSave = (): void => {
    setErrors({});
    const body: OrganisationUpdateInput = {
      name: name.trim(),
      gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
      currency: currency.trim().toUpperCase(),
    };
    update.mutate(body, {
      onSuccess: () => toast('Organisation saved', 'success'),
      onError: (e) => {
        if (e instanceof ApiError) setErrors(e.fieldErrors);
        toast(e instanceof Error ? e.message : 'Could not save', 'error');
      },
    });
  };

  return (
    <>
      <Panel
        title="Organisation"
        hint="Shown across the app and printed as the letterhead on purchase orders."
      >
        <Field label="Organisation name" error={errors.name}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            placeholder="e.g. ArtBox Solutions"
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label="Primary GSTIN"
            error={errors.gstin}
            hint="Per-state registrations are maintained under GST registrations."
          >
            <Input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              aria-invalid={!!errors.gstin}
              placeholder="15-character GSTIN"
              maxLength={15}
            />
          </Field>
          <Field label="Currency" error={errors.currency}>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              aria-invalid={!!errors.currency}
              maxLength={3}
            />
          </Field>
        </div>
      </Panel>

      <div className="flex items-center gap-3">
        <Button variant="accent" disabled={update.isPending} onClick={onSave}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <span className="text-[12px] text-faint">
          Applies to documents generated from now on.
        </span>
      </div>
    </>
  );
}
