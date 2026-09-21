'use client';

import { PERMISSIONS } from '@/lib/shared';
import { Button, EmptyState, PageHeader, Pill } from '@/components/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { displayNumber } from '@/components/approvals/display-number';
import { AttentionList, AttentionRow, AttentionTile } from '@/components/home/attention';
import {
  isForbidden,
  useHomeApprovalCounts,
  useHomeGrnCounts,
  useHomeInvoiceCounts,
  useHomeMsmeInvoices,
  useHomePoCounts,
  useHomeRequisitionBoard,
  useHomeWaiting,
} from '@/components/home/queries';
import { inr, msmeVariant } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';
import { useSessionStore } from '@/store/session-store';

const SLA_VARIANT = { ok: 'success', warn: 'warn', breach: 'danger' } as const;
const SLA_LABEL = { ok: 'On time', warn: 'Due soon', breach: 'Overdue' } as const;
const SLA_RANK = { breach: 0, warn: 1, ok: 2 } as const;

function documentTypeLabel(t: string): string {
  const s = t.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function greeting(now: Date | null): string {
  if (!now) return 'Welcome';
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * Buyer home — what needs this user's attention today, across modules.
 *
 * Every number is a count an existing list endpoint already returns, and each
 * tile links to that list. Tiles are gated on the permission the endpoint
 * checks, so a role only sees the modules it works in; with none, the page
 * says so rather than showing a wall of errors.
 */
export default function HomePage(): React.JSX.Element {
  const user = useSessionStore((s) => s.user);
  const firstName = (user?.name ?? '').split(' ')[0];
  // Read the clock after mount: the server's time zone is not the user's, and a
  // greeting rendered on both would mismatch on hydration.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  // Hooks are called unconditionally; each gates its own query.
  const canApprovals = useHasPermission(PERMISSIONS.APPROVAL_READ);
  const invTenant = useHasPermission(PERMISSIONS.INVOICE_READ_TENANT);
  const invTeam = useHasPermission(PERMISSIONS.INVOICE_READ_TEAM);
  const invAssigned = useHasPermission(PERMISSIONS.INVOICE_READ_ASSIGNED);
  const canInvoices = invTenant || invTeam || invAssigned;
  const canPos = useHasPermission(PERMISSIONS.PURCHASE_ORDER_READ_TENANT);
  const canGrn = useHasPermission(PERMISSIONS.GRN_READ);
  const canReqs = useHasPermission(PERMISSIONS.REQUISITION_READ_TENANT);
  const canCreateReq = useHasPermission(PERMISSIONS.REQUISITION_CREATE);

  const approvals = useHomeApprovalCounts(canApprovals);
  const waiting = useHomeWaiting(canApprovals);
  const invCounts = useHomeInvoiceCounts(canInvoices);
  const msme = useHomeMsmeInvoices(canInvoices);
  const po = useHomePoCounts(canPos);
  const grn = useHomeGrnCounts(canGrn);
  const board = useHomeRequisitionBoard(canReqs);

  const queue = useMemo(
    () =>
      [...(waiting.data?.items ?? [])]
        .sort(
          (a, b) =>
            SLA_RANK[a.slaStatus] - SLA_RANK[b.slaStatus] || b.daysPending - a.daysPending,
        )
        .slice(0, 6),
    [waiting.data],
  );
  const overdue = (waiting.data?.items ?? []).filter((i) => i.slaStatus === 'breach').length;

  // "At risk" = the MSMED Act 45-day clock is close or already past. The count
  // on the Invoices tab is every open MSME invoice, which overstates it.
  const atRisk = useMemo(
    () =>
      (msme.data?.items ?? [])
        .filter((i) => i.msme && i.msme.bucket !== 'SAFE')
        .sort((a, b) => (a.msme?.daysRemaining ?? 0) - (b.msme?.daysRemaining ?? 0)),
    [msme.data],
  );
  const breached = atRisk.filter((i) => i.msme?.bucket === 'BREACH').length;

  const anyModule = canApprovals || canInvoices || canPos || canGrn || canReqs;
  const showQueue = canApprovals && !isForbidden(waiting.error);
  const showMsme = canInvoices && !isForbidden(msme.error);

  return (
    <div>
      <PageHeader
        title={firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}
        description={
          now
            ? now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
            : ' '
        }
        actions={
          canCreateReq ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/requisitions/new">New requisition</Link>
            </Button>
          ) : undefined
        }
      />

      {!anyModule ? (
        <div className="border-line bg-panel mt-6 rounded-lg border">
          <EmptyState
            title="Nothing to show yet"
            detail="Your role doesn't include any of the queues summarised here. Use the navigation above, or ask an administrator if you expected to see approvals, invoices or orders."
          />
        </div>
      ) : (
        <>
          <h2 className="text-muted mb-3 mt-6 text-caption font-medium">Needs attention</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {canApprovals && (
              <AttentionTile
                label="Waiting on you"
                value={approvals.data?.total}
                tone={overdue > 0 ? 'danger' : 'warn'}
                footnote={overdue > 0 ? `${overdue} overdue` : 'Approvals to decide'}
                href="/inbox"
                isLoading={approvals.isLoading}
                error={approvals.error}
              />
            )}
            {canInvoices && (
              <AttentionTile
                label="Invoice exceptions"
                value={invCounts.data?.exceptions}
                tone="danger"
                footnote="Match exceptions to resolve"
                href="/invoices?tab=exceptions"
                isLoading={invCounts.isLoading}
                error={invCounts.error}
              />
            )}
            {canInvoices && (
              <AttentionTile
                label="MSME payments at risk"
                value={msme.data ? atRisk.length : undefined}
                tone={breached > 0 ? 'danger' : 'warn'}
                footnote={breached > 0 ? `${breached} past the 45-day limit` : 'Due within the MSME window'}
                href="/invoices?tab=msme"
                isLoading={msme.isLoading}
                error={msme.error}
              />
            )}
            {canInvoices && (
              <AttentionTile
                label="Approved, not scheduled"
                value={invCounts.data?.approved}
                tone="warn"
                footnote="Ready for a payment run"
                href="/invoices?tab=approved"
                isLoading={invCounts.isLoading}
                error={invCounts.error}
              />
            )}
            {canPos && (
              <AttentionTile
                label="POs awaiting receipt"
                value={po.data?.awaiting_grn}
                tone="warn"
                footnote="Issued, goods not yet received"
                href="/purchase-orders?tab=awaiting_grn"
                isLoading={po.isLoading}
                error={po.error}
              />
            )}
            {canGrn && (
              <AttentionTile
                label="Receipts awaiting QC"
                value={grn.data?.awaiting_qc}
                tone="warn"
                footnote={
                  grn.data && grn.data.held > 0 ? `${grn.data.held} on hold` : 'Inspection pending'
                }
                href="/goods-receipt?tab=awaiting_qc"
                isLoading={grn.isLoading}
                error={grn.error}
              />
            )}
            {canReqs && (
              <AttentionTile
                label="Requisitions to source"
                value={board.data?.counts.SOURCING}
                tone="warn"
                footnote="Approved, no PO yet"
                href="/requisitions"
                isLoading={board.isLoading}
                error={board.error}
              />
            )}
            {canInvoices && (
              <AttentionTile
                label="Awaiting tax invoice"
                value={invCounts.data?.proforma}
                footnote="Proformas to be replaced"
                href="/invoices?tab=proforma"
                isLoading={invCounts.isLoading}
                error={invCounts.error}
              />
            )}
          </div>

          {(showQueue || showMsme) && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {showQueue && (
                <AttentionList
                  title="Waiting on you"
                  href="/inbox"
                  linkLabel="Open inbox"
                  isLoading={waiting.isLoading}
                >
                  {queue.length === 0 ? (
                    <EmptyState
                      compact
                      title={waiting.error ? 'Couldn’t load your queue' : 'You’re all caught up'}
                      detail={
                        waiting.error
                          ? 'Open the inbox to try again.'
                          : 'Documents routed to you for a decision will appear here.'
                      }
                    />
                  ) : (
                    <ul className="divide-line divide-y py-1">
                      {queue.map((i) => (
                        <AttentionRow
                          key={i.approvalId}
                          href={i.href}
                          primary={
                            <>
                              {documentTypeLabel(i.documentType)}
                              {i.title !== i.number && (
                                <span className="text-muted font-normal"> · {i.title}</span>
                              )}
                            </>
                          }
                          meta={[displayNumber(i), `${i.daysPending}d pending`].filter(Boolean).join(' · ')}
                          aside={
                            <>
                              {i.amount && (
                                <span className="font-numeric text-ink block text-body-sm">
                                  {inr(i.amount)}
                                </span>
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
              )}
              {showMsme && (
                <AttentionList
                  title="MSME payments at risk"
                  href="/invoices?tab=msme"
                  linkLabel="All MSME invoices"
                  isLoading={msme.isLoading}
                >
                  {atRisk.length === 0 ? (
                    <EmptyState
                      compact
                      title={msme.error ? 'Couldn’t load MSME invoices' : 'No MSME payments at risk'}
                      detail={
                        msme.error
                          ? 'Open Invoices to try again.'
                          : 'Invoices from MSME suppliers nearing the 45-day payment limit appear here.'
                      }
                    />
                  ) : (
                    <ul className="divide-line divide-y py-1">
                      {atRisk.slice(0, 6).map((i) => (
                        <AttentionRow
                          key={i.id}
                          href={`/invoices/${i.id}`}
                          primary={i.vendor.name}
                          meta={i.number}
                          aside={
                            <>
                              <span className="font-numeric text-ink block text-body-sm">
                                {inr(i.grossAmount)}
                              </span>
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
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
