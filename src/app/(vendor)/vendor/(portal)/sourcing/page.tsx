'use client';

import {
  Button,
  DataState,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  PageHeader,
  Pill,
  SkeletonCards,
  Textarea,
} from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

import { useAcknowledge, useDecline, useInvitedRfqs } from '@/vendor/lib/sourcing';
import { useToastStore } from '@/vendor/store/toast-store';
import { formatDate, statusLabel, statusVariant } from '@/lib/format';

export default function VendorSourcingPage(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useInvitedRfqs();
  const empty = !isLoading && !error && (data?.items.length ?? 0) === 0;

  return (
    <div>
      <PageHeader
        title="RFQ invitations"
        description="Sealed bidding. Your quote stays private until the buyer's formal bid opening."
      />

      {/* The invitation cards are panels; the empty state gets the same frame
          so the page does not change shape between "none" and "some". */}
      <div className={empty ? 'border-line bg-panel rounded-lg border' : undefined}>
        <DataState
          isLoading={isLoading}
          error={error}
          onRetry={() => void refetch()}
          isEmpty={(data?.items.length ?? 0) === 0}
          loading={<SkeletonCards count={3} className="sm:grid-cols-1 xl:grid-cols-1" />}
          empty={{
            title: 'No invitations yet',
            detail: 'When a buyer invites you to quote on a request for quotation, it appears here.',
          }}
        >
          <div className="space-y-3">
            {data?.items.map((r) => (
              <InvitationCard key={r.id} rfq={r} />
            ))}
          </div>
        </DataState>
      </div>
    </div>
  );
}

function InvitationCard({
  rfq,
}: {
  rfq: {
    id: string;
    number: string;
    title: string;
    category: string;
    rfqType: string;
    status: string;
    invitationStatus: string;
    bidDeadline: string | null;
    hasQuote: boolean;
  };
}): React.JSX.Element {
  const ack = useAcknowledge(rfq.id);
  const decline = useDecline(rfq.id);
  const toast = useToastStore((s) => s.push);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('Capacity constrained');

  return (
    <div className="border-line bg-panel rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-numeric text-muted text-caption">{rfq.number}</span>
            <span className="text-muted text-caption">{statusLabel(rfq.rfqType)}</span>
            <Pill variant={statusVariant(rfq.invitationStatus)} dot>
              {statusLabel(rfq.invitationStatus)}
            </Pill>
          </div>
          <h2 className="text-ink mt-1 text-h3 font-semibold">{rfq.title}</h2>
          <p className="text-muted text-caption">
            {rfq.category} · Bids close{' '}
            <span className="font-numeric">
              {rfq.bidDeadline ? formatDate(rfq.bidDeadline) : '—'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
          {rfq.invitationStatus === 'INVITED' && (
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={ack.isPending}
                onClick={() =>
                  ack.mutate(undefined, {
                    onError: (e) => toast(e.message || 'Could not acknowledge', 'error'),
                  })
                }
              >
                Acknowledge
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeclining(true)}>
                Decline
              </Button>
            </>
          )}
          {['ACKNOWLEDGED', 'QUOTE_SUBMITTED'].includes(rfq.invitationStatus) && (
            <Button asChild variant="primary" size="sm">
              <Link href={`/vendor/sourcing/${rfq.id}`}>
                {rfq.hasQuote ? 'View quote' : 'Submit quote'}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Declining withdraws you from the RFQ, so it gets a confirm step and the
          buyer gets the reason rather than a silent drop-out. */}
      <Dialog open={declining} onOpenChange={setDeclining}>
        <DialogContent>
          <DialogTitle>Decline {rfq.number}?</DialogTitle>
          <DialogDescription>
            You will not be able to quote on this RFQ afterwards. The buyer sees your reason.
          </DialogDescription>
          <Field label="Reason" htmlFor={`decline-${rfq.id}`} className="mt-4">
            <Textarea
              id={`decline-${rfq.id}`}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeclining(false)}>
              Keep invitation
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!reason.trim() || decline.isPending}
              onClick={() =>
                decline.mutate(reason.trim(), {
                  onSuccess: () => {
                    setDeclining(false);
                    toast('Invitation declined', 'info');
                  },
                  onError: (e) => toast(e.message || 'Could not decline', 'error'),
                })
              }
            >
              Decline invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
