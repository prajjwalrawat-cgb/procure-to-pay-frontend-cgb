'use client';

import type { InvoiceListResponse } from '@/lib/shared';
import { DataState, PageHeader, Pill, SandboxBanner } from '@/components/ui';
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
import { useProviderLiveness } from '@/lib/integration-status';
import { useToastStore } from '@/store/toast-store';

export default function InvoiceIntakePage(): React.JSX.Element {
  const inboundQ = useInboundEmails();
  const inbound = inboundQ.data;
  const review = useQuery({
    queryKey: ['invoices', 'ocr-review'],
    queryFn: () =>
      apiFetch<InvoiceListResponse>(
        '/invoices?status=OCR_LOW_CONFIDENCE,OCR_FAILED&limit=50',
      ),
  });
  const { isSimulated } = useProviderLiveness();

  const pending = (inbound?.items ?? []).filter(
    (e) => e.status === 'PENDING_VENDOR_MATCH',
  );
  const dead = (inbound?.items ?? []).filter((e) => e.status === 'DEAD_LETTER');

  return (
    <div>
      <PageHeader
        title="Invoice intake"
        description="Email → invoice, manual OCR review, and quarantined senders, AP queue"
      />

      {/* Every invoice in this queue was read by the OCR provider. When that
          provider is a sandbox, the extracted figures below are fabricated —
          and this is the screen where a human copies them into a real invoice. */}
      {isSimulated('OCR') && (
        <SandboxBanner className="mb-4">
          <span className="font-semibold">OCR is running against a sandbox.</span>{' '}
          Extracted values on this queue are simulated, not read from the supplier&rsquo;s
          document. Verify every figure against the source PDF before saving.
        </SandboxBanner>
      )}

      <Section
        title="OCR review — low confidence / failed"
        count={review.data?.items.length ?? 0}
      >
        {/* Previously `!review.data` rendered the empty message, so a slow or
            failed fetch read as "nothing to review" on a work queue. */}
        <DataState
          isLoading={review.isLoading}
          error={review.error}
          isEmpty={(review.data?.items.length ?? 0) === 0}
          onRetry={() => void review.refetch()}
          compact
          empty={{
            title: 'Nothing awaiting manual data entry',
            detail: 'Invoices whose OCR came back low-confidence or failed land here.',
          }}
        >
          {review.data?.items.map((inv) => (
            <ReviewRow key={inv.id} inv={inv} onDone={() => void review.refetch()} />
          ))}
        </DataState>
      </Section>

      <Section title="Pending vendor match — unrecognised senders" count={pending.length}>
        <DataState
          isLoading={inboundQ.isLoading}
          error={inboundQ.error}
          isEmpty={pending.length === 0}
          onRetry={() => void inboundQ.refetch()}
          compact
          empty={{ title: 'No emails awaiting vendor attribution' }}
        >
          {pending.map((e) => (
            <PendingRow key={e.id} email={e} />
          ))}
        </DataState>
      </Section>

      <Section title="Dead letter — malformed emails" count={dead.length}>
        <DataState
          isLoading={inboundQ.isLoading}
          error={inboundQ.error}
          isEmpty={dead.length === 0}
          onRetry={() => void inboundQ.refetch()}
          compact
          empty={{ title: 'No dead-lettered emails' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
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
          </div>
        </DataState>
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
      <div className="flex items-center justify-between text-body-sm">
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
          className="border-line hover:bg-canvas rounded-md border px-3 py-1 text-caption"
        >
          {open ? 'Cancel' : 'Enter data'}
        </button>
      </div>
      {open && (
        <div className="bg-canvas mt-2 grid grid-cols-1 gap-2 rounded-md p-2 sm:grid-cols-2 lg:grid-cols-4">
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
            className="bg-accent rounded-md px-3 py-1.5 text-body-sm font-medium text-white sm:col-span-2 lg:col-span-4"
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
    <div className="border-line flex items-center justify-between border-b py-2 text-body-sm last:border-0">
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
          className="bg-ink rounded-md px-3 py-1.5 text-caption font-medium text-white disabled:opacity-40"
        >
          Attribute
        </button>
      </div>
    </div>
  );
}

const i =
  'rounded-md border border-line bg-panel px-2 py-1.5 text-body-sm outline-none focus:border-ink';

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
      <h2 className="text-ink mb-2 text-body-sm font-semibold">
        {title} <span className="text-faint">({count})</span>
      </h2>
      {children}
    </div>
  );
}

