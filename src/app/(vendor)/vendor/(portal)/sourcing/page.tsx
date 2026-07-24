'use client';

import { Button, Pill } from '@/components/ui';
import Link from 'next/link';

import { useAcknowledge, useDecline, useInvitedRfqs } from '@/vendor/lib/sourcing';

export default function VendorSourcingPage(): React.JSX.Element {
  const { data, isLoading } = useInvitedRfqs();

  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="tracking-heading text-ink mb-1 text-[20px] font-semibold">
        RFQ invitations
      </h1>
      <p className="text-muted mb-4 text-[13px]">
        Sealed bidding — your quote is private until the buyer&apos;s formal open
        ceremony.
      </p>

      {isLoading && <p className="text-muted">Loading…</p>}
      {data?.items.length === 0 && (
        <p className="text-muted text-[13px]">No invitations yet.</p>
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
    <div className="border-line bg-panel rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-accent font-mono text-[12px]">{rfq.number}</span>
            <Pill variant="gray">{rfq.rfqType.replace(/_/g, ' ').toLowerCase()}</Pill>
            <Pill variant="info">{rfq.invitationStatus.toLowerCase()}</Pill>
          </div>
          <h2 className="text-ink mt-1 text-[15px] font-semibold">{rfq.title}</h2>
          <p className="text-muted text-[12px]">
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
