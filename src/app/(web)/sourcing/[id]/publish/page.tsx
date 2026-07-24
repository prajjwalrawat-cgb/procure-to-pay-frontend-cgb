'use client';

import { Button, Input, Pill } from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useInvite, usePublish, useRfq } from '@/lib/api/sourcing';
import { useToastStore } from '@/store/toast-store';

function plusDays(d: number): string {
  return new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 16);
}

export default function PublishPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data: rfq } = useRfq(id);
  const invite = useInvite(id);
  const publish = usePublish(id);

  const [vendorIds, setVendorIds] = useState('');
  const [qa, setQa] = useState(plusDays(3));
  const [bid, setBid] = useState(plusDays(10));
  const [tech, setTech] = useState(plusDays(11));
  const [comm, setComm] = useState(plusDays(14));
  const [award, setAward] = useState(plusDays(20));
  const [spotBuyException, setSpotBuyException] = useState(false);

  const twoEnvelope = rfq?.rfqType === 'TWO_ENVELOPE';

  const addVendors = (): void => {
    const ids = vendorIds.split(/[\s,]+/).filter(Boolean);
    if (ids.length === 0) return;
    invite.mutate(
      { vendorIds: ids, source: 'DIRECTORY', isPreliminaryInvitation: false },
      {
        onSuccess: (r) => {
          toast(`${r.added} vendor(s) invited`, 'success');
          setVendorIds('');
        },
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const doPublish = (): void => {
    publish.mutate(
      {
        qaDeadline: new Date(qa).toISOString(),
        bidDeadline: new Date(bid).toISOString(),
        techOpenAt: twoEnvelope ? new Date(tech).toISOString() : null,
        commercialOpenAt: twoEnvelope ? new Date(comm).toISOString() : null,
        awardDeadline: new Date(award).toISOString(),
        spotBuyException,
      },
      {
        onSuccess: (r) => {
          toast(`Published — ${r.status}`, 'success');
          router.push(`/sourcing/${id}`);
        },
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="tracking-heading text-ink mb-1 text-[20px] font-semibold">
        Publish {rfq?.number}
      </h1>
      <p className="text-muted mb-4 text-[13px]">
        Invite vendors and set the timeline. After publishing, criteria and lines are
        immutable.
      </p>

      <Section title="Invitations">
        {rfq?.invitations.map((i) => (
          <div key={i.id} className="flex items-center gap-2 py-1 text-[13px]">
            <Pill variant="gray">{i.source.toLowerCase()}</Pill>
            <span>{i.vendorName}</span>
            {i.isMsme && <Pill variant="violet">MSME</Pill>}
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="vendor IDs (space/comma separated)"
            value={vendorIds}
            onChange={(e) => setVendorIds(e.target.value)}
          />
          <Button variant="accent" onClick={addVendors} disabled={invite.isPending}>
            Invite
          </Button>
        </div>
        {(rfq?.invitations.length ?? 0) < 2 && (
          <label className="text-muted mt-2 flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={spotBuyException}
              onChange={(e) => setSpotBuyException(e.target.checked)}
            />
            Single-source: spot-buy exemption + PLANT_HEAD approval
          </label>
        )}
      </Section>

      <Section title="Timing (IST)">
        <TimeField label="Q&A deadline" value={qa} onChange={setQa} />
        <TimeField label="Bid deadline" value={bid} onChange={setBid} />
        {twoEnvelope && <TimeField label="Tech open" value={tech} onChange={setTech} />}
        {twoEnvelope && (
          <TimeField label="Commercial open" value={comm} onChange={setComm} />
        )}
        <TimeField label="Award deadline" value={award} onChange={setAward} />
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/sourcing/${id}`)}>
          Back
        </Button>
        <Button variant="primary" onClick={doPublish} disabled={publish.isPending}>
          {publish.isPending ? 'Publishing…' : 'Publish RFQ'}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel mb-4 rounded-lg border p-4">
      <h2 className="text-ink mb-3 text-[14px] font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <label className="mb-2 flex items-center justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <input
        type="datetime-local"
        className="border-line bg-panel h-9 rounded-md border px-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
