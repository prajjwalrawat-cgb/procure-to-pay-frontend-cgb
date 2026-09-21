'use client';

import { Badge, Button, Input, PageHeader, Pill } from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  useInvite,
  usePublish,
  useRemoveInvitation,
  useRfq,
} from '@/lib/api/sourcing';
import { useVendorList } from '@/lib/api/vendors';
import { useToastStore } from '@/store/toast-store';

function plusDays(d: number): string {
  return new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 16);
}

/**
 * Picks vendors to invite by name.
 *
 * The API takes vendor ids, which used to mean pasting `ven_01…` strings in by
 * hand. It also refuses a vendor with no verified bank account unless the
 * invitation is explicitly preliminary, so unverified vendors are marked here
 * rather than failing on submit.
 */
function VendorPicker({
  invitedIds,
  onPick,
}: {
  invitedIds: Set<string>;
  onPick: (vendorId: string) => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useVendorList('active');

  const q = query.trim().toLowerCase();
  const matches = (data?.items ?? [])
    .filter((v) => !invitedIds.has(v.id))
    .filter(
      (v) =>
        !q ||
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        (v.legalEntityName ?? '').toLowerCase().includes(q),
    )
    .slice(0, 30);

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={isLoading ? 'Loading active vendors…' : 'Search vendors by name…'}
      />
      {open && (
        <div className="border-line bg-panel absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-lg">
          {matches.length === 0 ? (
            <p className="text-muted px-3 py-2 text-caption">No active vendor matches.</p>
          ) : (
            matches.map((v) => (
              <button
                key={v.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(v.id);
                  setQuery('');
                  setOpen(false);
                }}
                className="hover:bg-canvas flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-caption"
              >
                <span className="truncate">
                  <span className="text-text">{v.name}</span>{' '}
                  <span className="font-numeric text-faint">{v.code}</span>
                </span>
                <span className="text-muted shrink-0">
                  {v.isMsme ? 'MSME, ' : ''}
                  {v.category ?? '—'}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PublishPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data: rfq } = useRfq(id);
  const invite = useInvite(id);
  const remove = useRemoveInvitation(id);
  const publish = usePublish(id);

  const [preliminary, setPreliminary] = useState(false);
  const [qa, setQa] = useState(plusDays(3));
  const [bid, setBid] = useState(plusDays(10));
  const [tech, setTech] = useState(plusDays(11));
  const [comm, setComm] = useState(plusDays(14));
  const [award, setAward] = useState(plusDays(20));
  const [spotBuyException, setSpotBuyException] = useState(false);

  const twoEnvelope = rfq?.rfqType === 'TWO_ENVELOPE';

  /** The API records a reason on every withdrawal — it is an audited change to
   *  who was given the chance to bid, not just a UI tidy-up. */
  const removeVendor = (invitationId: string, vendorName: string): void => {
    const reason = window.prompt(`Why is ${vendorName} being removed from this RFQ?`);
    if (reason == null || reason.trim().length === 0) return;
    remove.mutate(
      { invitationId, reason: reason.trim() },
      {
        onSuccess: () => toast(`${vendorName} removed`, 'success'),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const addVendor = (vendorId: string): void => {
    invite.mutate(
      {
        vendorIds: [vendorId],
        source: 'DIRECTORY',
        isPreliminaryInvitation: preliminary,
      },
      {
        onSuccess: (r) => toast(`${r.added} vendor(s) invited`, 'success'),
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
    <div className="mx-auto w-full max-w-[720px]">
      <PageHeader
        title={`Publish ${rfq?.number ?? ''}`.trim()}
        breadcrumbs={[{ label: 'Sourcing', href: '/sourcing' }, { label: 'Publish' }]}
        description="Invite vendors and set the timeline. After publishing, criteria and lines are immutable."
      />

      <Section title="Invitations">
        {rfq?.invitations.map((i) => (
          <div key={i.id} className="flex items-center gap-2 py-1 text-body-sm">
            <Pill variant="gray">{i.source.toLowerCase()}</Pill>
            <span>{i.vendorName}</span>
            {i.isMsme && <Badge variant="classification">MSME</Badge>}
            <button
              type="button"
              onClick={() => removeVendor(i.id, i.vendorName)}
              disabled={remove.isPending}
              className="text-muted hover:text-danger ml-auto text-caption"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="mt-2">
          <VendorPicker
            invitedIds={new Set((rfq?.invitations ?? []).map((i) => i.vendorId))}
            onPick={addVendor}
          />
          <label className="text-muted mt-2 flex items-center gap-2 text-caption">
            <input
              type="checkbox"
              checked={preliminary}
              onChange={(e) => setPreliminary(e.target.checked)}
            />
            Preliminary invitation — allows a vendor whose bank account is not yet
            verified (they can quote, but cannot be awarded until it is)
          </label>
        </div>
        {(rfq?.invitations.length ?? 0) < 2 && (
          <label className="text-muted mt-2 flex items-center gap-2 text-caption">
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
      <h2 className="text-ink mb-3 text-body font-semibold">{title}</h2>
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
    <label className="mb-2 flex items-center justify-between text-body-sm">
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
