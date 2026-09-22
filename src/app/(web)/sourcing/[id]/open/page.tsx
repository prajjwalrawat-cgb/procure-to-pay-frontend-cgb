'use client';

import {
  Button,
  Checkbox,
  ErrorState,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useOpenEnvelope, useRfq } from '@/lib/api/sourcing';
import { roleLabel, useTeam } from '@/lib/api/users';
import { useToastStore } from '@/store/toast-store';

/**
 * Quote-open ceremony. Above-threshold RFQs require ≥2 participants from
 * different roles; participant user IDs are recorded on the QuoteOpenLog.
 */
export default function OpenCeremonyPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data: rfq, isLoading, error, refetch } = useRfq(id);
  const openTech = useOpenEnvelope(id, 'technical');
  const openComm = useOpenEnvelope(id, 'commercial');

  const [participants, setParticipants] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  // Witnesses are picked by name from the team. Typing raw user ids remains
  // only as the fallback for a caller who cannot read the team list.
  const team = (useTeam().data ?? []).filter((u) => u.isActive);
  const byName = team.length > 0;

  const ids = (): string[] =>
    byName ? picked : participants.split(/[\s,]+/).filter(Boolean);

  const fire = (m: typeof openTech, label: string): void => {
    m.mutate(ids(), {
      onSuccess: (r) => {
        toast(`${label}: ${r.opened} quote(s) opened`, 'success');
        router.push(`/sourcing/${id}/evaluate`);
      },
      onError: (e) => toast(e.message, 'error'),
    });
  };

  const twoEnvelope = rfq?.rfqType === 'TWO_ENVELOPE';

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-lg border border-line bg-panel">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  if (isLoading || !rfq) {
    return (
      <div aria-busy="true" className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        title={`Quote-open ceremony — ${rfq.number}`}
        breadcrumbs={[
          { label: 'Sourcing', href: '/sourcing' },
          { label: rfq.number, href: `/sourcing/${id}` },
          { label: 'Quote open' },
        ]}
        description={
          <>
            {rfq.submittedCount} of {rfq.invitedCount} vendors submitted. This RFQ is
            above the multi-party threshold — two witnesses from different roles are
            required.
          </>
        }
      />

      <div className="mb-4 rounded-lg border border-line bg-panel p-4">
        {byName ? (
          <fieldset>
            <legend className="mb-2 text-caption font-medium text-text">
              Witnesses ({picked.length} selected)
            </legend>
            <div className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
              {team.map((u) => (
                <label
                  key={u.id}
                  className="flex min-w-0 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-canvas"
                >
                  <Checkbox
                    checked={picked.includes(u.id)}
                    onChange={(e) =>
                      setPicked((p) =>
                        e.target.checked ? [...p, u.id] : p.filter((x) => x !== u.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-body-sm text-text">
                      {u.name}
                    </span>
                    <span className="block truncate text-micro text-faint">
                      {u.roles.map(roleLabel).join(', ')}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <label className="mb-1 block">
            <span className="mb-1 block text-caption font-medium text-text">
              Participant user IDs (space or comma separated)
            </span>
            <Input
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="Participant user ids"
            />
          </label>
        )}
        <p className="mt-2 text-caption text-muted">
          Each open is logged with its participants, a timestamp and a before/after hash.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {twoEnvelope ? (
          <>
            <Button
              variant="primary"
              onClick={() => fire(openTech, 'Technical open')}
              disabled={openTech.isPending}
            >
              Open technical envelopes
            </Button>
            {/* Technical opens first; commercial is the follow-up, so only one
                of the pair is the filled button. */}
            <Button
              variant="secondary"
              onClick={() => fire(openComm, 'Commercial open')}
              disabled={openComm.isPending}
            >
              Open commercial envelopes
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            onClick={() => fire(openComm, 'Open')}
            disabled={openComm.isPending}
          >
            Open quotes
          </Button>
        )}
        <Button variant="ghost" onClick={() => router.push(`/sourcing/${id}`)}>
          Back
        </Button>
      </div>
    </div>
  );
}
