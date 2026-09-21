'use client';

import type { InboxItem, InvoiceListItem } from '@/lib/shared';
import { EmptyState, Pill } from '@/components/ui';

import { displayNumber } from '@/components/approvals/display-number';
import { inr, msmeVariant } from '@/lib/format';

import { AttentionList, AttentionRow } from './attention';

const SLA_VARIANT = { ok: 'success', warn: 'warn', breach: 'danger' } as const;
const SLA_LABEL = { ok: 'On time', warn: 'Due soon', breach: 'Overdue' } as const;

function documentTypeLabel(t: string): string {
  const s = t.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Top of the user's approval inbox, most urgent first (sorted by the caller). */
export function WaitingQueue({
  items,
  isLoading,
  error,
}: {
  items: InboxItem[];
  isLoading: boolean;
  error: unknown;
}): React.JSX.Element {
  return (
    <AttentionList title="Waiting on you" href="/inbox" linkLabel="Open inbox" isLoading={isLoading}>
      {items.length === 0 ? (
        <EmptyState
          compact
          title={error ? 'Couldn’t load your queue' : 'You’re all caught up'}
          detail={
            error
              ? 'Open the inbox to try again.'
              : 'Documents routed to you for a decision will appear here.'
          }
        />
      ) : (
        <ul className="divide-line divide-y py-1">
          {items.map((i) => (
            <AttentionRow
              key={i.approvalId}
              href={i.href}
              primary={
                <>
                  {documentTypeLabel(i.documentType)}
                  {i.title !== i.number && <span className="text-muted font-normal"> · {i.title}</span>}
                </>
              }
              meta={[displayNumber(i), `${i.daysPending}d pending`].filter(Boolean).join(' · ')}
              aside={
                <>
                  {i.amount && (
                    <span className="font-numeric text-ink block text-body-sm">{inr(i.amount)}</span>
                  )}
                  <Pill variant={SLA_VARIANT[i.slaStatus]} dot>
                    {SLA_LABEL[i.slaStatus]}
                  </Pill>
                </>
              }
            />
          ))}
        </ul>
      )}
    </AttentionList>
  );
}

/** MSME invoices nearest (or past) the 45-day limit, most urgent first. */
export function MsmeQueue({
  items,
  isLoading,
  error,
}: {
  items: InvoiceListItem[];
  isLoading: boolean;
  error: unknown;
}): React.JSX.Element {
  return (
    <AttentionList
      title="MSME payments at risk"
      href="/invoices?tab=msme"
      linkLabel="All MSME invoices"
      isLoading={isLoading}
    >
      {items.length === 0 ? (
        <EmptyState
          compact
          title={error ? 'Couldn’t load MSME invoices' : 'No MSME payments at risk'}
          detail={
            error
              ? 'Open Invoices to try again.'
              : 'Invoices from MSME suppliers nearing the 45-day payment limit appear here.'
          }
        />
      ) : (
        <ul className="divide-line divide-y py-1">
          {items.map((i) => (
            <AttentionRow
              key={i.id}
              href={`/invoices/${i.id}`}
              primary={i.vendor.name}
              meta={i.number}
              aside={
                <>
                  <span className="font-numeric text-ink block text-body-sm">{inr(i.grossAmount)}</span>
                  {i.msme && (
                    <Pill variant={msmeVariant(i.msme.bucket)} dot>
                      {i.msme.daysRemaining < 0
                        ? `${-i.msme.daysRemaining}d overdue`
                        : `${i.msme.daysRemaining}d left`}
                    </Pill>
                  )}
                </>
              }
            />
          ))}
        </ul>
      )}
    </AttentionList>
  );
}
