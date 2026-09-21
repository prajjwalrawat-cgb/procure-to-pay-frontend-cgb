'use client';

import type { InvoiceListResponse } from '@/lib/shared';
import {
  Button,
  DataState,
  Field,
  Input,
  PageHeader,
  Pill,
  SandboxBanner,
  Select,
} from '@/components/ui';
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
import { statusLabel, statusVariant } from '@/lib/format';
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
        description="The AP work queue for invoices that could not be read or attributed automatically."
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
        title="OCR review"
        detail="Low-confidence or failed extractions that need the figures entered by hand."
        count={review.data ? review.data.items.length : undefined}
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

      <Section
        title="Pending vendor match"
        detail="Invoices emailed from an address no vendor is registered under."
        count={inbound ? pending.length : undefined}
      >
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

      <Section
        title="Dead letter"
        detail="Emails that could not be turned into an invoice at all."
        count={inbound ? dead.length : undefined}
      >
        <DataState
          isLoading={inboundQ.isLoading}
          error={inboundQ.error}
          isEmpty={dead.length === 0}
          onRetry={() => void inboundQ.refetch()}
          compact
          empty={{ title: 'No dead-lettered emails' }}
        >
          <table className="pf-stack w-full text-body-sm">
            <thead className="border-line border-b text-left text-caption text-muted">
              <tr>
                <th className="py-2.5 pr-3 font-medium">From</th>
                <th className="px-3 py-2.5 font-medium">Subject</th>
                <th className="py-2.5 pl-3 text-right font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {dead.map((e) => (
                <tr key={e.id} className="border-line border-b last:border-0">
                  <td className="font-numeric py-3 pr-3 break-all">{e.fromEmail}</td>
                  <td className="text-muted px-3 py-3">{e.subject ?? '—'}</td>
                  <td className="py-3 pl-3 text-right">
                    <Pill variant="danger" dot>
                      {e.deadLetterReason ? statusLabel(e.deadLetterReason) : '—'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    <div className="border-line border-b py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/invoices/${inv.id}`}
            className="font-numeric text-ink font-medium hover:text-accent"
          >
            {inv.number}
          </Link>
          <span className="text-muted">{inv.vendor.name}</span>
          <Pill variant={statusVariant(inv.status)} dot>
            {statusLabel(inv.status)}
          </Pill>
        </div>
        <Button variant={open ? 'ghost' : 'secondary'} size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : 'Enter data'}
        </Button>
      </div>
      {open && (
        <div className="bg-canvas mt-3 grid grid-cols-1 gap-3 rounded-md p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Vendor invoice ref" htmlFor={`ref-${inv.id}`}>
            <Input id={`ref-${inv.id}`} value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
          <Field label="Item description" htmlFor={`desc-${inv.id}`} required>
            <Input id={`desc-${inv.id}`} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <Field label="Quantity" htmlFor={`qty-${inv.id}`}>
            <Input
              id={`qty-${inv.id}`}
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Unit price (₹)" htmlFor={`price-${inv.id}`} required>
            <Input
              id={`price-${inv.id}`}
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <div className="flex justify-end sm:col-span-2 lg:col-span-4">
            <Button variant="primary" size="sm" onClick={() => void submit()} disabled={complete.isPending}>
              {complete.isPending ? 'Saving…' : 'Save & match'}
            </Button>
          </div>
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
    <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b py-3 text-body-sm last:border-0">
      <div className="min-w-0">
        <div className="font-numeric text-text break-all">{email.fromEmail}</div>
        <div className="text-muted text-caption">{email.subject ?? 'No subject'}</div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <Select
          className="min-w-0 flex-1 sm:w-56 sm:flex-none"
          aria-label={`Vendor for ${email.fromEmail}`}
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        >
          <option value="">Attribute to…</option>
          {vendors?.items.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          size="sm"
          disabled={!vendorId || resolve.isPending}
          onClick={async () => {
            try {
              await resolve.mutateAsync({ id: email.id, vendorId });
              push('Attributed — invoice created', 'success');
            } catch (e) {
              push(e instanceof Error ? e.message : 'Failed', 'error');
            }
          }}
        >
          Attribute
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  detail,
  count,
  children,
}: {
  title: string;
  detail: string;
  /** Undefined until the queue has loaded — a "0" beside an error reads as "done". */
  count?: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="border-line bg-panel mb-4 rounded-lg border p-4">
      <h2 className="text-ink text-h3 font-semibold">
        {title}
        {count !== undefined && (
          <span className="font-numeric text-muted ml-2 text-body-sm font-normal">{count}</span>
        )}
      </h2>
      <p className="text-muted mb-2 mt-0.5 text-caption">{detail}</p>
      {children}
    </section>
  );
}

