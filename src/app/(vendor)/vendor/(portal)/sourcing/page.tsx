'use client';

import { Button, PageHeader, Pill } from '@/components/ui';
import Link from 'next/link';

import { useAcknowledge, useDecline, useInvitedRfqs } from '@/vendor/lib/sourcing';

export default function VendorSourcingPage(): React.JSX.Element {
  const { data, isLoading } = useInvitedRfqs();

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        title="RFQ invitations"
        description="Sealed bidding — your quote is private until the buyer's formal open ceremony."
      />

      {isLoading && <p className="text-muted">Loading…</p>}
      {data?.items.length === 0 && (
        <p className="text-[13px] text-muted">No invitations yet.</p>
      )}

      <div className="space-y-3">
        {data?.items.map((r) => (
          <InvitationCard key={r.id} rfq={r} />
        ))}
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

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] text-accent">{rfq.number}</span>
            <Pill variant="gray">{rfq.rfqType.replace(/_/g, ' ').toLowerCase()}</Pill>
            <Pill variant="info">{rfq.invitationStatus.toLowerCase()}</Pill>
          </div>
          <h2 className="mt-1 text-[15px] font-semibold text-ink">{rfq.title}</h2>
          <p className="text-[12px] text-muted">
            {rfq.category} · deadline{' '}
            {rfq.bidDeadline
              ? new Date(rfq.bidDeadline).toLocaleDateString('en-IN')
              : '—'}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {rfq.invitationStatus === 'INVITED' && (
            <>
              <Button variant="accent" onClick={() => ack.mutate()}>
                Acknowledge
              </Button>
              <Button
                variant="ghost"
                onClick={() => decline.mutate('Capacity constrained')}
              >
                Decline
              </Button>
            </>
          )}
          {['ACKNOWLEDGED', 'QUOTE_SUBMITTED'].includes(rfq.invitationStatus) && (
            <Link href={`/vendor/sourcing/${rfq.id}`}>
              <Button variant="primary">
                {rfq.hasQuote ? 'View quote' : 'Submit quote'}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
