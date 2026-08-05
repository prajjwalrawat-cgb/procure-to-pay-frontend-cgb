'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@/components/ui';
import { InviteVendorInputSchema, VENDOR_CATEGORY_CONFIGS } from '@/lib/shared';
import { useState } from 'react';

import { ApiError, zodFieldErrors, zodSummary } from '@/lib/api-error';
import { useInviteVendor } from '@/lib/api/vendors';
import { useToastStore } from '@/store/toast-store';

/** Label + input + the reason it was rejected, if any. */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-muted">{label}</label>
      {children}
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  );
}

export function InviteVendorDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const [legalEntityName, setLegalEntityName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [categoryKey, setCategoryKey] = useState(
    VENDOR_CATEGORY_CONFIGS[0]?.categoryKey ?? '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const invite = useInviteVendor();
  const toast = useToastStore((s) => s.push);

  const submit = (): void => {
    const input = {
      legalEntityName: legalEntityName.trim(),
      name: (name || legalEntityName).trim(),
      email: email.trim(),
      categoryKey,
      source: 'BUYER_INVITE_SPOT' as const,
    };

    // Validate with the same schema the API enforces, so a typo like a missing
    // "@" is caught here with the field flagged instead of costing a round trip
    // that comes back as an anonymous 422.
    const parsed = InviteVendorInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      toast(zodSummary(parsed.error, 'Check the highlighted fields'), 'error');
      return;
    }
    setErrors({});

    invite.mutate(input, {
      onSuccess: () => {
        toast('Vendor invited — onboarding started', 'success');
        setLegalEntityName('');
        setName('');
        setEmail('');
        onClose();
      },
      onError: (e) => {
        // The API may reject for reasons the client schema can't know (duplicate
        // email, unknown category) — surface those against the field too.
        if (e instanceof ApiError) setErrors(e.fieldErrors);
        toast(e.message || 'Could not invite vendor', 'error');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Invite vendor</DialogTitle>
        <DialogDescription>
          Emails the vendor a secure link to set their password and complete the 6-step
          onboarding wizard. It then lands in the review queue.
        </DialogDescription>
        <div className="mt-4 space-y-3">
          <Field label="Legal entity name" error={errors.legalEntityName}>
            <Input
              value={legalEntityName}
              onChange={(e) => setLegalEntityName(e.target.value)}
              placeholder="Acme Industries Pvt Ltd"
              aria-invalid={!!errors.legalEntityName}
            />
          </Field>
          <Field label="Display name (optional)" error={errors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme"
              aria-invalid={!!errors.name}
            />
          </Field>
          <Field label="Contact email" error={errors.email}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sales@acme.example"
              aria-invalid={!!errors.email}
            />
          </Field>
          <Field label="Category" error={errors.categoryKey}>
            <select
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
              className="bg-surface w-full rounded-md border border-line px-3 py-2 text-[13px] text-ink"
            >
              {VENDOR_CATEGORY_CONFIGS.map((c) => (
                <option key={c.categoryKey} value={c.categoryKey}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={invite.isPending || !legalEntityName || !email}
          >
            {invite.isPending ? 'Inviting…' : 'Send invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
