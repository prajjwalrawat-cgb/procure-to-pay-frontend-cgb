'use client';

import type { InvoiceListResponse } from '@procureflow/shared';
import { Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client';
import {
  useCompleteManualEntry,
  useInboundEmails,
  useResolveVendorMatch,
} from '@/lib/api/integrations';
import { useVendorList } from '@/lib/api/vendors';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

export default function InvoiceIntakePage(): React.JSX.Element {
  const { data: inbound } = useInboundEmails();
  const review = useQuery({
    queryKey: ['invoices', 'ocr-review'],
    queryFn: () =>
      apiFetch<InvoiceListResponse>(
        '/invoices?status=OCR_LOW_CONFIDENCE,OCR_FAILED&limit=50',
      ),
  });

  const pending = (inbound?.items ?? []).filter(
    (e) => e.status === 'PENDING_VENDOR_MATCH',
  );
  const dead = (inbound?.items ?? []).filter((e) => e.status === 'DEAD_LETTER');

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          Invoice intake
        </h1>
        <p className="text-muted text-[13px]">
          Email → invoice, manual OCR review, and quarantined senders · AP queue
        </p>
      </div>

      <Section
        title="OCR review — low confidence / failed"
        count={review.data?.items.length ?? 0}
      >
        {!review.data || review.data.items.length === 0 ? (
          <Empty text="Nothing awaiting manual data entry." />
        ) : (
          review.data.items.map((inv) => (
            <ReviewRow key={inv.id} inv={inv} onDone={() => review.refetch()} />
          ))
        )}
      </Section>

      <Section title="Pending vendor match — unrecognised senders" count={pending.length}>
        {pending.length === 0 ? (
          <Empty text="No emails awaiting vendor attribution." />
        ) : (
          pending.map((e) => <PendingRow key={e.id} email={e} />)
        )}
      </Section>

      <Section title="Dead letter — malformed emails" count={dead.length}>
        {dead.length === 0 ? (
          <Empty text="No dead-lettered emails." />
        ) : (
          <table className="w-full text-[13px]">
            <tbody>
              {dead.map((e) => (
                <tr key={e.id} className="border-line border-b last:border-0">
                  <td className="py-1.5">{e.fromEmail}</td>
                  <td className="text-muted py-1.5">{e.subject ?? '—'}</td>
                  <td className="py-1.5 text-right">
                    <Pill variant="danger">{e.deadLetterReason}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function ReviewRow({
  inv,
  onDone,
}: {
  inv: InvoiceListResponse['items'][number];
  onDone: () => void;
}): React.JSX.Element {
  const push = useToastStore((s) => s.push);
  const complete = useCompleteManualEntry(inv.id);
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState(inv.vendorInvoiceRef ?? '');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');

  const submit = async (): Promise<void> => {
    if (!desc || !price) {
      push('Enter a description and price', 'error');
      return;
    }
    try {
      await complete.mutateAsync({
        vendorInvoiceRef: ref || null,
        invoiceDate: null,
        lines: [{ itemDesc: desc, uom: 'EA', qty, unitPrice: price, taxRate: '0.18' }],
      });
      push('Manual entry saved — invoice matched', 'success');
      onDone();
    } catch (e) {
      push(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  return (
    <div className="border-line border-b py-2 last:border-0">
      <div className="flex items-center justify-between text-[13px]">
        <div>
          <Link href={`/invoices/${inv.id}`} className="text-accent-2 font-numeric">
            {inv.number}
          </Link>
          <span className="text-muted ml-2">{inv.vendor.name}</span>
          <Pill variant={statusVariant(inv.status)}>{statusLabel(inv.status)}</Pill>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="border-line hover:bg-canvas rounded-md border px-3 py-1 text-[12px]"
        >
          {open ? 'Cancel' : 'Enter data'}
        </button>
      </div>
      {open && (
        <div className="bg-canvas mt-2 grid grid-cols-4 gap-2 rounded-md p-2">
          <input
            className={i}
            placeholder="Vendor inv ref"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
          <input
            className={i}
            placeholder="Item description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <input
            className={i}
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <input
            className={i}
            placeholder="Unit price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <button
            type="button"
            onClick={submit}
            className="bg-accent col-span-4 rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
          >
            Save & match
          </button>
        </div>
      )}
    </div>
  );
}

function PendingRow({
  email,
}: {
  email: NonNullable<ReturnType<typeof useInboundEmails>['data']>['items'][number];
}): React.JSX.Element {
  const push = useToastStore((s) => s.push);
  const { data: vendors } = useVendorList('active');
  const resolve = useResolveVendorMatch();
  const [vendorId, setVendorId] = useState('');

  return (
    <div className="border-line flex items-center justify-between border-b py-2 text-[13px] last:border-0">
      <div>
        <span className="font-numeric">{email.fromEmail}</span>
        <span className="text-muted ml-2">{email.subject ?? '—'}</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          className={i}
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        >
          <option value="">Attribute to…</option>
          {vendors?.items.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!vendorId}
          onClick={async () => {
            try {
              await resolve.mutateAsync({ id: email.id, vendorId });
              push('Attributed — invoice created', 'success');
            } catch (e) {
              push(e instanceof Error ? e.message : 'Failed', 'error');
            }
          }}
          className="bg-ink rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
        >
          Attribute
        </button>
      </div>
    </div>
  );
}

const i =
  'rounded-md border border-line bg-panel px-2 py-1.5 text-[13px] outline-none focus:border-ink';

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel mb-4 rounded-lg border p-4">
      <h2 className="text-ink mb-2 text-[13px] font-semibold">
        {title} <span className="text-faint">({count})</span>
      </h2>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }): React.JSX.Element {
  return <p className="text-muted py-4 text-center text-[13px]">{text}</p>;
}
