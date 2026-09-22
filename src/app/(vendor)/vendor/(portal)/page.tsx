'use client';

import { Button, EmptyState, PageHeader, Pill } from '@/components/ui';
import Link from 'next/link';
import { useMemo } from 'react';

import { AttentionList, AttentionRow, AttentionTile } from '@/components/home/attention';
import { formatDate, inr, statusLabel, statusVariant } from '@/lib/format';
import { useVendorContracts } from '@/vendor/lib/api/contracts';
import { useMyInvoices } from '@/vendor/lib/api/invoices';
import { useVendorPos } from '@/vendor/lib/api/purchase-orders';
import { useVendorRmas } from '@/vendor/lib/api/receipts';
import { useOnboarding } from '@/vendor/lib/onboarding';
import { useSessionStore } from '@/vendor/store/session-store';

/** Invoice states that are finished from the supplier's side. */
const INVOICE_DONE = new Set(['PAID', 'REJECTED', 'CANCELLED']);
/** Approved by the buyer, money not (fully) out yet. */
const INVOICE_TO_BE_PAID = new Set(['APPROVED', 'SCHEDULED', 'PARTIALLY_PAID']);
/** PO states still expecting goods from the supplier. */
const PO_OPEN = new Set(['ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED']);

/**
 * Supplier dashboard — what the buyer is waiting on from this supplier, and
 * where their money is.
 *
 * Built only from the lists the portal already serves (POs, invoices, returns,
 * contracts, onboarding). Each query fails on its own: a supplier still in
 * onboarding may get errors from the transactional lists, and that should hide
 * a tile, not the page.
 */
export default function VendorHomePage(): React.JSX.Element {
  const name = useSessionStore((s) => s.user?.name ?? '');
  const firstName = name.split(' ')[0];

  const onboarding = useOnboarding();
  const pos = useVendorPos();
  const invoices = useMyInvoices();
  const rmas = useVendorRmas();
  const contracts = useVendorContracts();

  const poItems = useMemo(() => pos.data?.items ?? [], [pos.data]);
  const invItems = useMemo(() => invoices.data ?? [], [invoices.data]);

  const toAcknowledge = poItems.filter((p) => p.status === 'ISSUED' && !p.acknowledged);
  const openPos = useMemo(() => poItems.filter((p) => PO_OPEN.has(p.status)), [poItems]);
  const inReview = invItems.filter(
    (i) => !INVOICE_DONE.has(i.status) && !INVOICE_TO_BE_PAID.has(i.status),
  );
  const toBePaid = invItems.filter((i) => INVOICE_TO_BE_PAID.has(i.status));
  const toBePaidTotal = toBePaid.reduce((s, i) => s + Number(i.grossAmount || 0), 0);
  const proformas = invItems.filter(
    (i) => i.documentKind === 'PROFORMA' && i.status !== 'REJECTED',
  );
  const pickups = (rmas.data?.items ?? []).filter(
    (r) => r.status === 'ISSUED' && !r.pickupScheduledAt,
  );
  const toSign = (contracts.data ?? []).filter(
    (c) => c.status === 'AWAITING_VENDOR_SIGNATURE',
  );

  // Open POs, the ones needing an acknowledgement first, then by delivery date.
  const poList = useMemo(
    () =>
      [...openPos]
        .sort(
          (a, b) =>
            Number(a.acknowledged) - Number(b.acknowledged) ||
            (a.expectedDeliveryDate ?? '9999').localeCompare(b.expectedDeliveryDate ?? '9999'),
        )
        .slice(0, 6),
    [openPos],
  );
  const recentInvoices = useMemo(
    () => [...invItems].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)).slice(0, 6),
    [invItems],
  );

  const ob = onboarding.data;
  const banner = !ob
    ? null
    : ob.lifecycleStatus === 'ACTIVE'
      ? null
      : ob.reviewDecision === 'RETURNED_FOR_INFO'
        ? {
            tone: 'warn' as const,
            pill: 'Action needed',
            text: 'Your buyer needs more information before your account can be approved.',
            cta: 'Update onboarding',
          }
        : ob.submittedAt
          ? {
              tone: 'info' as const,
              pill: 'Under review',
              text: `Onboarding submitted on ${formatDate(ob.submittedAt)} — your buyer is reviewing it.`,
              cta: 'View submission',
            }
          : {
              tone: 'warn' as const,
              pill: 'Not submitted',
              text: 'Finish onboarding so your buyer can issue purchase orders and pay your invoices.',
              cta: 'Continue onboarding',
            };

  return (
    <div>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : 'Supplier dashboard'}
        description="What your buyer is waiting on, and where your payments stand."
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/vendor/invoices/submit">Submit an invoice</Link>
          </Button>
        }
      />

      {banner && (
        <div className="border-line bg-panel mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Pill variant={banner.tone} dot>
              {banner.pill}
            </Pill>
            <span className="text-text text-body-sm">{banner.text}</span>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/vendor/onboarding">{banner.cta}</Link>
          </Button>
        </div>
      )}

      <h2 className="text-muted mb-3 mt-6 text-caption font-medium">Needs attention</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AttentionTile
          label="POs to acknowledge"
          value={pos.data ? toAcknowledge.length : undefined}
          tone="warn"
          footnote={`${openPos.length} open order${openPos.length === 1 ? '' : 's'}`}
          href="/vendor/purchase-orders"
          isLoading={pos.isLoading}
          error={pos.error}
        />
        <AttentionTile
          label="Invoices in review"
          value={invoices.data ? inReview.length : undefined}
          footnote={
            proformas.length > 0
              ? `${proformas.length} proforma${proformas.length === 1 ? '' : 's'} need a tax invoice`
              : 'With your buyer'
          }
          tone={proformas.length > 0 ? 'warn' : 'neutral'}
          href="/vendor/invoices"
          isLoading={invoices.isLoading}
          error={invoices.error}
        />
        <AttentionTile
          label="Approved, awaiting payment"
          value={invoices.data ? toBePaid.length : undefined}
          footnote={toBePaid.length > 0 ? inr(toBePaidTotal, 0) : 'Nothing outstanding'}
          href="/vendor/invoices"
          isLoading={invoices.isLoading}
          error={invoices.error}
        />
        <AttentionTile
          label="Contracts to sign"
          value={contracts.data ? toSign.length : undefined}
          tone="warn"
          footnote="Awaiting your signature"
          href="/vendor/contracts"
          isLoading={contracts.isLoading}
          error={contracts.error}
        />
        <AttentionTile
          label="Returns to schedule"
          value={rmas.data ? pickups.length : undefined}
          tone="warn"
          footnote="Pickup date needed"
          href="/vendor/rma"
          isLoading={rmas.isLoading}
          error={rmas.error}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AttentionList
          title="Open purchase orders"
          href="/vendor/purchase-orders"
          linkLabel="All orders"
          isLoading={pos.isLoading}
        >
          {poList.length === 0 ? (
            <EmptyState
              compact
              title={pos.error ? 'Couldn’t load purchase orders' : 'No open purchase orders'}
              detail={
                pos.error
                  ? 'Open Purchase orders to try again.'
                  : 'Orders your buyer issues to you will appear here.'
              }
            />
          ) : (
            <ul className="divide-line divide-y py-1">
              {poList.map((p) => (
                <AttentionRow
                  key={p.id}
                  href={`/vendor/purchase-orders/${p.id}`}
                  primary={<span className="font-numeric">{p.number}</span>}
                  meta={
                    p.expectedDeliveryDate
                      ? `${p.description} · due ${formatDate(p.expectedDeliveryDate)}`
                      : p.description
                  }
                  aside={
                    <>
                      <span className="font-numeric text-ink block text-body-sm">
                        {inr(p.totalAmount)}
                      </span>
                      {p.acknowledged ? (
                        <Pill variant="info" dot>
                          {p.fulfilmentPct}% received
                        </Pill>
                      ) : (
                        <Pill variant="warn" dot>
                          Acknowledge
                        </Pill>
                      )}
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </AttentionList>

        <AttentionList
          title="Recent invoices"
          href="/vendor/invoices"
          linkLabel="All invoices"
          isLoading={invoices.isLoading}
        >
          {recentInvoices.length === 0 ? (
            <EmptyState
              compact
              title={invoices.error ? 'Couldn’t load invoices' : 'No invoices yet'}
              detail={
                invoices.error
                  ? 'Open Invoices to try again.'
                  : 'Submit an invoice against a purchase order to get paid.'
              }
            />
          ) : (
            <ul className="divide-line divide-y py-1">
              {recentInvoices.map((i) => (
                <AttentionRow
                  key={i.id}
                  href="/vendor/invoices"
                  primary={i.vendorInvoiceRef || i.number}
                  meta={[
                    i.vendorInvoiceRef && i.vendorInvoiceRef !== i.number ? i.number : null,
                    formatDate(i.invoiceDate),
                    i.documentKind === 'PROFORMA' ? 'Proforma' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  aside={
                    <>
                      <span className="font-numeric text-ink block text-body-sm">
                        {inr(i.grossAmount)}
                      </span>
                      <Pill variant={statusVariant(i.status)} dot>
                        {statusLabel(i.status)}
                      </Pill>
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </AttentionList>
      </div>
    </div>
  );
}
