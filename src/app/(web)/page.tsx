'use client';

import { PERMISSIONS } from '@/lib/shared';
import { Button, EmptyState, PageHeader, cn } from '@/components/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ActivityFeed } from '@/components/home/activity-feed';
import { ApprovalPipeline } from '@/components/home/approval-pipeline';
import { AttentionTile } from '@/components/home/attention';
import { relativeTime } from '@/components/home/home-format';
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
import { MsmeQueue, WaitingQueue } from '@/components/home/queues';
import { SpendTrendChart } from '@/components/home/spend-trend-chart';
import { ThroughputChart } from '@/components/home/throughput-chart';
import { UpcomingRuns } from '@/components/home/upcoming-runs';
import { VolumetricStrip } from '@/components/home/volumetric-strip';
import { useHomeSummary } from '@/lib/api/home';
import { useHasPermission } from '@/lib/permissions';
import { useSessionStore } from '@/store/session-store';

const SLA_RANK = { breach: 0, warn: 1, ok: 2 } as const;

/** Needs-attention grid by tile count — literal classes so Tailwind emits them. */
const TILE_COLS: Record<number, string> = {
  1: 'sm:grid-cols-2',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-3 xl:grid-cols-5',
  6: 'sm:grid-cols-3 xl:grid-cols-6',
  7: 'sm:grid-cols-4 xl:grid-cols-7',
  8: 'sm:grid-cols-4 xl:grid-cols-8',
};

function greeting(now: Date | null): string {
  if (!now) return 'Welcome';
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function SectionHeading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 className="text-muted mb-3 mt-6 text-caption font-medium">{children}</h2>;
}

/**
 * Buyer home — the command center. "What does the operation look like right
 * now, and what needs me": ambient awareness up top (volumetric strip, spend
 * and throughput charts), direct action below (needs-attention tiles, the two
 * queues, live activity, approval pipeline, upcoming payment runs).
 *
 * The ambient layer and the activity / pipeline / runs widgets read the
 * analytics rollup and need `analytics:read`. A role without it gets the
 * action layer alone, which is still a complete page, and sends no request
 * that would 403. Needs-attention numbers are counts existing list endpoints
 * already return; each tile links to that list and is gated on the permission
 * its endpoint checks, so a role only sees the modules it works in — with
 * none, the page says so rather than showing a wall of errors.
 */
export default function HomePage(): React.JSX.Element {
  const user = useSessionStore((s) => s.user);
  const firstName = (user?.name ?? '').split(' ')[0];
  // Read the clock after mount: the server's time zone is not the user's, and a
  // greeting rendered on both would mismatch on hydration. The minute tick
  // keeps the time and "Updated … ago" honest on a page left open all day.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

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
  const canAnalytics = useHasPermission(PERMISSIONS.ANALYTICS_READ);

  const summary = useHomeSummary(canAnalytics);
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
  // The queues row holds up to three cards; its grid follows how many this
  // role actually gets, so two cards split the width instead of leaving a hole.
  const rowCount = [showQueue, showMsme, canAnalytics].filter(Boolean).length;
  // Same idea for the needs-attention tiles: a role with three modules gets
  // three full-width tiles, not three slivers at the left of an 8-column row.
  const tileCount =
    [canApprovals, canPos, canGrn, canReqs].filter(Boolean).length + (canInvoices ? 4 : 0);
  const compactTiles = tileCount > 4;

  const dateLine = now
    ? `${now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · ${now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
    : ' ';
  // There is no health endpoint, so no "all systems operational" pill — the
  // honest ambient signal is how fresh the rollup behind the numbers is.
  const updated =
    summary.data && now ? `Updated ${relativeTime(summary.data.asOf, now.getTime())}` : null;

  return (
    <div>
      <PageHeader
        title={firstName ? `${greeting(now)}, ${firstName}` : greeting(now)}
        description={updated ? `${dateLine} · ${updated}` : dateLine}
        actions={
          canCreateReq ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/requisitions/new">New requisition</Link>
            </Button>
          ) : undefined
        }
      />

      {!anyModule && !canAnalytics ? (
        <div className="border-line bg-panel mt-6 rounded-lg border">
          <EmptyState
            title="Nothing to show yet"
            detail="Your role doesn't include any of the queues summarised here. Use the navigation above, or ask an administrator if you expected to see approvals, invoices or orders."
          />
        </div>
      ) : (
        <>
          {canAnalytics && (
            <>
              <SectionHeading>At a glance</SectionHeading>
              <VolumetricStrip
                data={summary.data}
                isLoading={summary.isLoading}
                error={summary.error}
              />
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <SpendTrendChart
                  data={summary.data}
                  isLoading={summary.isLoading}
                  error={summary.error}
                  onRetry={() => void summary.refetch()}
                />
                <ThroughputChart
                  data={summary.data}
                  isLoading={summary.isLoading}
                  error={summary.error}
                  onRetry={() => void summary.refetch()}
                />
              </div>
            </>
          )}

          {anyModule && (
            <>
              <SectionHeading>Needs attention</SectionHeading>
              <div className={cn('grid grid-cols-2 gap-3', TILE_COLS[tileCount] ?? TILE_COLS[8])}>
                {canApprovals && (
                  <AttentionTile
                    compact={compactTiles}
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
                    compact={compactTiles}
                    label="Invoice exceptions"
                    value={invCounts.data?.exceptions}
                    tone="danger"
                    footnote="Match exceptions"
                    href="/invoices?tab=exceptions"
                    isLoading={invCounts.isLoading}
                    error={invCounts.error}
                  />
                )}
                {canInvoices && (
                  <AttentionTile
                    compact={compactTiles}
                    label="MSME payments at risk"
                    value={msme.data ? atRisk.length : undefined}
                    tone={breached > 0 ? 'danger' : 'warn'}
                    footnote={breached > 0 ? `${breached} past 45 days` : 'Within the MSME window'}
                    href="/invoices?tab=msme"
                    isLoading={msme.isLoading}
                    error={msme.error}
                  />
                )}
                {canInvoices && (
                  <AttentionTile
                    compact={compactTiles}
                    label="Approved, not scheduled"
                    value={invCounts.data?.approved}
                    tone="warn"
                    footnote="Ready for a run"
                    href="/invoices?tab=approved"
                    isLoading={invCounts.isLoading}
                    error={invCounts.error}
                  />
                )}
                {canPos && (
                  <AttentionTile
                    compact={compactTiles}
                    label="POs awaiting receipt"
                    value={po.data?.awaiting_grn}
                    tone="warn"
                    footnote="Goods not yet received"
                    href="/purchase-orders?tab=awaiting_grn"
                    isLoading={po.isLoading}
                    error={po.error}
                  />
                )}
                {canGrn && (
                  <AttentionTile
                    compact={compactTiles}
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
                    compact={compactTiles}
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
                    compact={compactTiles}
                    label="Awaiting tax invoice"
                    value={invCounts.data?.proforma}
                    footnote="Proformas to replace"
                    href="/invoices?tab=proforma"
                    isLoading={invCounts.isLoading}
                    error={invCounts.error}
                  />
                )}
              </div>
            </>
          )}

          {rowCount > 0 && (
            <div
              className={cn(
                'mt-6 grid gap-4',
                rowCount === 3 && 'md:grid-cols-2 xl:grid-cols-3',
                rowCount === 2 && 'lg:grid-cols-2',
              )}
            >
              {showQueue && (
                <WaitingQueue items={queue} isLoading={waiting.isLoading} error={waiting.error} />
              )}
              {showMsme && (
                <MsmeQueue
                  items={atRisk.slice(0, 6)}
                  isLoading={msme.isLoading}
                  error={msme.error}
                />
              )}
              {canAnalytics && (
                // With three cards at tablet width the feed takes the full
                // second row rather than sitting beside an empty half.
                <ActivityFeed
                  enabled={canAnalytics}
                  className={cn(rowCount === 3 && 'md:col-span-2 xl:col-span-1')}
                />
              )}
            </div>
          )}

          {canAnalytics && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ApprovalPipeline enabled={canAnalytics} />
              <UpcomingRuns enabled={canAnalytics} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
