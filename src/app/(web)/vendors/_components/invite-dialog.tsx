'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@/components/ui';
import { InviteVendorInputSchema } from '@/lib/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ApiError, zodFieldErrors, zodSummary } from '@/lib/api-error';
import { useVendorCategoryOptions } from '@/lib/api/settings';
import { useInviteVendor } from '@/lib/api/vendors';
import { useToastStore } from '@/store/toast-store';

/**
 * The 409 the API raises when this invite would create a second record for a
 * vendor already on the books. `overridable` is false for an email collision —
 * both records would share one vendor login — and true for a fuzzy name match,
 * which can legitimately be a different entity.
 */
interface DuplicateWarning {
  message: string;
  overridable: boolean;
  vendorId: string | null;
  vendorName: string | null;
  onboardingId: string | null;
}

function toDuplicateWarning(e: ApiError): DuplicateWarning | null {
  if (e.status !== 409) return null;
  const c = e.context;
  const str = (k: string): string | null =>
    typeof c[k] === 'string' ? (c[k] as string) : null;
  return {
    message: e.message,
    overridable: c.overridable === true,
    vendorId: str('existingVendorId'),
    vendorName: str('existingVendorName'),
    onboardingId: str('existingOnboardingId'),
  };
}

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
  // Categories are this organisation's own (Settings → Vendor categories), so
  // the list is fetched rather than compiled in.
  const { data: categories } = useVendorCategoryOptions();
  const [categoryKey, setCategoryKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<DuplicateWarning | null>(null);
  const invite = useInviteVendor();
  const toast = useToastStore((s) => s.push);

  useEffect(() => {
    if (!categoryKey && categories?.length) setCategoryKey(categories[0].key);
  }, [categories, categoryKey]);

  /** Any edit invalidates the warning — it was about the previous values. */
  const edit = (set: (v: string) => void) => (v: string) => {
    setDuplicate(null);
    set(v);
  };

  const submit = (allowDuplicate = false): void => {
    const input = {
      legalEntityName: legalEntityName.trim(),
      name: (name || legalEntityName).trim(),
      email: email.trim(),
      categoryKey,
      source: 'BUYER_INVITE_SPOT' as const,
      allowDuplicate,
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
        setDuplicate(null);
        onClose();
      },
      onError: (e) => {
        // The API may reject for reasons the client schema can't know (duplicate
        // vendor, unknown category) — surface those against the field too.
        if (e instanceof ApiError) {
          setErrors(e.fieldErrors);
          const dup = toDuplicateWarning(e);
          // A duplicate gets the inline panel, not just a toast that vanishes:
          // it needs a link to the record it collided with and, when the match
          // is only a similar name, a way to go ahead anyway.
          if (dup) {
            setDuplicate(dup);
            return;
          }
        }
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
        {duplicate && (
          <div className="border-warn/40 bg-warn/10 mt-4 rounded-md border p-3">
            <p className="text-ink text-[13px] font-medium">
              This looks like an existing vendor
            </p>
            <p className="text-muted mt-1 text-[12px]">{duplicate.message}</p>
            {duplicate.onboardingId && (
              <Link
                href={`/vendors/onboarding/${duplicate.onboardingId}`}
                className="text-brand mt-2 inline-block text-[12px] font-medium hover:underline"
                onClick={onClose}
              >
                Open {duplicate.vendorName ?? 'the existing'} onboarding →
              </Link>
            )}
            {!duplicate.onboardingId && duplicate.vendorId && (
              <Link
                href={`/vendors/${duplicate.vendorId}`}
                className="text-brand mt-2 inline-block text-[12px] font-medium hover:underline"
                onClick={onClose}
              >
                Open {duplicate.vendorName ?? 'the existing vendor'} →
              </Link>
            )}
          </div>
        )}
        <div className="mt-4 space-y-3">
          <Field label="Legal entity name" error={errors.legalEntityName}>
            <Input
              value={legalEntityName}
              onChange={(e) => edit(setLegalEntityName)(e.target.value)}
              placeholder="Acme Industries Pvt Ltd"
              aria-invalid={!!errors.legalEntityName}
            />
          </Field>
          <Field label="Display name (optional)" error={errors.name}>
            <Input
              value={name}
              onChange={(e) => edit(setName)(e.target.value)}
              placeholder="Acme"
              aria-invalid={!!errors.name}
            />
          </Field>
          <Field label="Contact email" error={errors.email}>
            <Input
              type="email"
              value={email}
              onChange={(e) => edit(setEmail)(e.target.value)}
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
              {(categories ?? []).map((c) => (
                <option key={c.key} value={c.key}>
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
          {duplicate?.overridable && (
            <Button
              variant="default"
              onClick={() => submit(true)}
              disabled={invite.isPending}
            >
              Invite anyway
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => submit()}
            disabled={invite.isPending || !legalEntityName || !email || !categoryKey}
          >
            {invite.isPending ? 'Inviting…' : 'Send invitation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
