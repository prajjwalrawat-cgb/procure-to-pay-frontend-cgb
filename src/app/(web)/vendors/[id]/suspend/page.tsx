'use client';

import {
  Button,
  Card,
  CardContent,
  DataState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  cn,
} from '@/components/ui';
import { PERMISSIONS, SUSPENSION_REASON_CODE, SUSPENSION_TYPE } from '@/lib/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useTeam } from '@/lib/api/users';
import { useBlacklistVendor, useSuspendVendor, useVendor360 } from '@/lib/api/vendors';
import { humanise } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { useToastStore } from '@/store/toast-store';

type Mode = 'suspend' | 'blacklist';

export default function SuspendVendorPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const vendor = useVendor360(params.id);
  // The API decides who may do what (blacklist also needs the MD role and a
  // Legal Officer co-sign); these only keep the page from offering a mode
  // whose endpoint would 403.
  const canSuspend = useHasPermission(PERMISSIONS.VENDOR_SUSPEND);
  const canBlacklist = useHasPermission(PERMISSIONS.VENDOR_BLACKLIST);
  // Roster for the co-signer picker. It needs USER_READ, which an MD may not
  // hold — on a 403 the field falls back to a plain user-id input.
  const team = useTeam();
  const legalOfficers = (team.data ?? []).filter(
    (u) => u.isActive && u.roles.includes('LEGAL_OFFICER'),
  );

  const [chosen, setChosen] = useState<Mode | null>(null);
  const mode: Mode = chosen ?? (canSuspend || !canBlacklist ? 'suspend' : 'blacklist');
  const [suspensionType, setSuspensionType] =
    useState<(typeof SUSPENSION_TYPE)[number]>('TEMPORARY');
  const [reasonCode, setReasonCode] =
    useState<(typeof SUSPENSION_REASON_CODE)[number]>('QUALITY_ISSUE');
  const [reasonNotes, setReasonNotes] = useState('');
  const [cosignerId, setCosignerId] = useState('');
  const [notesError, setNotesError] = useState('');

  const suspend = useSuspendVendor(params.id);
  const blacklist = useBlacklistVendor(params.id);
  const pending = suspend.isPending || blacklist.isPending;
  const back = `/vendors/${params.id}`;
  const name = vendor.data?.name ?? 'Vendor';

  const submit = (): void => {
    if (!reasonNotes.trim()) {
      setNotesError('A reason is required — it is recorded in the audit log.');
      return;
    }
    setNotesError('');
    if (mode === 'suspend') {
      suspend.mutate(
        { suspensionType, reasonCode, reasonNotes },
        {
          onSuccess: () => {
            toast(`${name} suspended`, 'success');
            router.push(back);
          },
          onError: (e) => toast(e.message, 'error'),
        },
      );
    } else {
      blacklist.mutate(
        { reasonNotes, cosignerId: cosignerId || undefined },
        {
          onSuccess: () => {
            toast(`${name} blacklisted`, 'success');
            router.push(back);
          },
          onError: (e) => toast(e.message, 'error'),
        },
      );
    }
  };

  const header = (
    <PageHeader
      title="Suspend or blacklist"
      breadcrumbs={[
        { label: 'Vendors', href: '/vendors' },
        { label: name, href: back },
        { label: 'Suspend or blacklist' },
      ]}
      description="Vendors are never deleted. A suspension blocks new POs while existing POs continue; a blacklist is permanent."
    />
  );

  if (vendor.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {header}
        <div
          className="space-y-3 rounded-lg border border-line bg-panel p-4"
          aria-busy="true"
        >
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  // Only an active vendor can be suspended or blacklisted; anything else (or a
  // failed load) gets a state, not a form that would be refused on submit.
  if (vendor.error || !vendor.data || vendor.data.lifecycleStatus !== 'ACTIVE') {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {header}
        <div className="rounded-lg border border-line bg-panel">
          <DataState
            error={vendor.error}
            isEmpty
            onRetry={() => void vendor.refetch()}
            empty={{
              title: vendor.data ? `${name} is not active` : 'Vendor not found',
              detail: vendor.data
                ? `Only an active vendor can be suspended or blacklisted. This one is ${humanise(vendor.data.lifecycleStatus).toLowerCase()}.`
                : undefined,
              action: (
                <Button asChild variant="secondary" size="sm">
                  <Link href={vendor.data ? back : '/vendors'}>
                    {vendor.data ? 'Back to vendor' : 'Back to vendors'}
                  </Link>
                </Button>
              ),
            }}
          >
            {null}
          </DataState>
        </div>
      </div>
    );
  }

  if (!canSuspend && !canBlacklist) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {header}
        <div className="rounded-lg border border-line bg-panel">
          <DataState
            isEmpty
            empty={{
              title: 'You cannot suspend or blacklist vendors',
              detail:
                'Your role does not include vendor suspension. Ask someone who holds it.',
              action: (
                <Button asChild variant="secondary" size="sm">
                  <Link href={back}>Back to vendor</Link>
                </Button>
              ),
            }}
          >
            {null}
          </DataState>
        </div>
      </div>
    );
  }

  const modes: { key: Mode; title: string; detail: string; allowed: boolean }[] = [
    {
      key: 'suspend',
      title: 'Suspend',
      detail:
        'Blocks new POs and withdraws open RFQ invitations. Existing POs continue. Can be lifted later.',
      allowed: canSuspend,
    },
    {
      key: 'blacklist',
      title: 'Blacklist',
      detail: 'Permanent. MD only, with a Legal Officer co-sign.',
      allowed: canBlacklist,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      {header}

      <Card>
        <CardContent className="space-y-5 pt-4">
          <fieldset>
            <legend className="mb-1.5 text-caption font-medium text-text">Action</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {modes
                .filter((m) => m.allowed)
                .map((m) => {
                  const active = mode === m.key;
                  return (
                    <label
                      key={m.key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-hover',
                        active
                          ? m.key === 'blacklist'
                            ? 'border-danger bg-danger-bg'
                            : 'border-accent bg-accent-wash'
                          : 'border-line hover:bg-canvas',
                      )}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={m.key}
                        checked={active}
                        onChange={() => setChosen(m.key)}
                        className="mt-0.5 accent-[var(--accent)]"
                      />
                      <span>
                        <span className="block text-body-sm font-medium text-ink">
                          {m.title}
                        </span>
                        <span className="block text-caption text-muted">{m.detail}</span>
                      </span>
                    </label>
                  );
                })}
            </div>
          </fieldset>

          {mode === 'suspend' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" htmlFor="suspension-type">
                <Select
                  id="suspension-type"
                  value={suspensionType}
                  onChange={(e) =>
                    setSuspensionType(e.target.value as (typeof SUSPENSION_TYPE)[number])
                  }
                >
                  {SUSPENSION_TYPE.filter((t) => t !== 'BLACKLIST').map((t) => (
                    <option key={t} value={t}>
                      {humanise(t)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason code" htmlFor="reason-code">
                <Select
                  id="reason-code"
                  value={reasonCode}
                  onChange={(e) =>
                    setReasonCode(
                      e.target.value as (typeof SUSPENSION_REASON_CODE)[number],
                    )
                  }
                >
                  {SUSPENSION_REASON_CODE.map((r) => (
                    <option key={r} value={r}>
                      {humanise(r)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {mode === 'blacklist' && (
            <Field
              label="Legal Officer co-signer"
              htmlFor="cosigner"
              required
              hint="Must be a different person from you. The co-sign is recorded against their name."
            >
              {team.isSuccess ? (
                <Select
                  id="cosigner"
                  value={cosignerId}
                  onChange={(e) => setCosignerId(e.target.value)}
                  disabled={legalOfficers.length === 0}
                >
                  <option value="">
                    {legalOfficers.length === 0
                      ? 'No active Legal Officer in this organisation'
                      : 'Choose a Legal Officer'}
                  </option>
                  {legalOfficers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="cosigner"
                  value={cosignerId}
                  onChange={(e) => setCosignerId(e.target.value)}
                  placeholder="usr_… (the Legal Officer's user id)"
                  className="font-numeric"
                />
              )}
            </Field>
          )}

          <Field
            label="Reason and notes"
            htmlFor="reason-notes"
            required
            error={notesError}
          >
            <Textarea
              id="reason-notes"
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              rows={4}
              aria-invalid={!!notesError}
              placeholder={
                mode === 'blacklist'
                  ? 'What happened, and the evidence behind it'
                  : 'What happened, and what would need to change to lift it'
              }
            />
          </Field>
        </CardContent>

        {/* Not CardFooter: its metadata slot truncates, and at phone width
            the two buttons left it no room at all. */}
        <div className="flex flex-col-reverse gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption text-muted">
            Recorded in the audit log against your name.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="secondary">
              <Link href={back}>Cancel</Link>
            </Button>
            <Button
              variant={mode === 'blacklist' ? 'danger' : 'primary'}
              disabled={pending}
              onClick={submit}
            >
              {pending
                ? 'Saving…'
                : mode === 'blacklist'
                  ? `Blacklist ${name}`
                  : `Suspend ${name}`}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
