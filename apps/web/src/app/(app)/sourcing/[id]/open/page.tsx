'use client';

import { Button, Input } from '@procureflow/ui';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useOpenEnvelope, useRfq } from '@/lib/api/sourcing';
import { useToastStore } from '@/store/toast-store';

/**
 * Quote-open ceremony. Above-threshold RFQs require ≥2 participants from
 * different roles; participant user IDs are recorded on the QuoteOpenLog.
 */
export default function OpenCeremonyPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data: rfq } = useRfq(id);
  const openTech = useOpenEnvelope(id, 'technical');
  const openComm = useOpenEnvelope(id, 'commercial');

  const [participants, setParticipants] = useState('');

  const ids = (): string[] => participants.split(/[\s,]+/).filter(Boolean);

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

  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="tracking-heading text-ink mb-1 text-[20px] font-semibold">
        Quote-open ceremony — {rfq?.number}
      </h1>
      <p className="text-muted mb-4 text-[13px]">
        {rfq?.submittedCount} of {rfq?.invitedCount} vendors submitted. This RFQ is above
        the multi-party threshold — two witnesses from different roles are required.
      </p>

      <div className="border-line bg-panel mb-4 rounded-lg border p-4">
        <label className="mb-1 block">
          <span className="text-muted mb-1 block text-[12px]">
            Participant user IDs (space/comma separated)
          </span>
          <Input
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            placeholder="usr_harpreet usr_das"
          />
        </label>
        <p className="text-faint text-[12px]">
          Each open is logged with participant IDs, a timestamp and a before/after hash.
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
            <Button
              variant="accent"
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
