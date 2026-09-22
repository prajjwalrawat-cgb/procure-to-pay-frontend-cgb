'use client';

import { Button, Input } from '@/components/ui';
import type { OrganisationUpdateInput } from '@/lib/shared';
import { useEffect, useState } from 'react';

import { useOrganisationSettings, useUpdateOrganisation } from '@/lib/api/settings';
import { ApiError } from '@/lib/api-error';
import { useToastStore } from '@/store/toast-store';
import { Field, Panel, SectionLoading } from './ui';

/** Legal identity: the name on every purchase order and across the app. */
export function OrganisationSection(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useOrganisationSettings();
  const update = useUpdateOrganisation();
  const toast = useToastStore((s) => s.push);

  const [name, setName] = useState('');
  const [pan, setPan] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setName(data.tenant.name);
    setPan(data.tenant.pan ?? '');
    setCurrency(data.tenant.currency);
  }, [data]);

  if (isLoading || !data) {
    return <SectionLoading error={error} onRetry={() => void refetch()} />;
  }

  const onSave = (): void => {
    setErrors({});
    const body: OrganisationUpdateInput = {
      name: name.trim(),
      pan: pan.trim() ? pan.trim().toUpperCase() : null,
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
        {/* No company-wide GSTIN: a GSTIN belongs to a state registration, so
            it lives on the branch that holds it, under GST registrations. */}
        <Field label="Currency" error={errors.currency}>
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            aria-invalid={!!errors.currency}
            maxLength={3}
          />
        </Field>
        <Field
          label="PAN"
          error={errors.pan}
          hint="One per company, however many state registrations you hold. Printed on the PO so vendors can claim credit for TDS deducted."
        >
          <Input
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase())}
            aria-invalid={!!errors.pan}
            placeholder="10-character PAN"
            maxLength={10}
          />
        </Field>
      </Panel>

      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={update.isPending} onClick={onSave}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <span className="text-caption text-faint">
          Applies to documents generated from now on.
        </span>
      </div>
    </>
  );
}
