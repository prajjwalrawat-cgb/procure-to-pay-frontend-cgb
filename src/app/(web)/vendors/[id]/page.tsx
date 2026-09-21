'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataState,
  MetricBar,
  PageHeader,
  Skeleton,
  StatusText,
} from '@/components/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PERMISSIONS } from '@/lib/shared';

import {
  RiskGradeChip,
  ScorecardGradeChip,
  VendorTrustBadges,
  useCategoryLabel,
} from '@/components/vendors/vendor-badges';
import { useVendor360 } from '@/lib/api/vendors';
import { formatDate, humanise, inr, statusLabel, statusVariant } from '@/lib/format';
import { useHasPermission } from '@/lib/permissions';

const DOC_VARIANT: Record<string, 'success' | 'warn' | 'danger' | 'neutral'> = {
  AUTO_VERIFIED: 'success',
  MANUALLY_VERIFIED: 'success',
  PENDING: 'warn',
  FAILED: 'danger',
  EXPIRED: 'danger',
};

/** One label/value line in a fact list. */
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-body-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-ink">{children}</dd>
    </div>
  );
}

export default function Vendor360Page(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useVendor360(params.id);
  const categoryLabel = useCategoryLabel();
  // The route guards are the real gate; this only hides a button that would 403.
  const canSuspend = useHasPermission(PERMISSIONS.VENDOR_SUSPEND);
  const canBlacklist = useHasPermission(PERMISSIONS.VENDOR_BLACKLIST);

  if (isLoading) return <DetailSkeleton />;

  if (error || !data) {
    return (
      <div>
        <PageHeader
          title="Vendor"
          breadcrumbs={[{ label: 'Vendors', href: '/vendors' }, { label: 'Vendor' }]}
        />
        <div className="rounded-lg border border-line bg-panel">
          <DataState
            error={error}
            isEmpty={!data}
            onRetry={() => void refetch()}
            empty={{
              title: 'Vendor not found',
              detail: 'It may have been archived, or the link is wrong.',
              action: (
                <Button asChild variant="secondary" size="sm">
                  <Link href="/vendors">Back to vendors</Link>
                </Button>
              ),
            }}
          >
            {null}
          </DataState>
        </div>
      </div>
    );
  }

  const sc = data.scorecard;
  const category = categoryLabel(data.category);
  const tags = [
    ...new Set([...(data.categoryTags ?? []), ...(data.capabilityTags ?? [])]),
  ];

  return (
    <div>
      <PageHeader
        title={data.name}
        breadcrumbs={[{ label: 'Vendors', href: '/vendors' }, { label: data.name }]}
        meta={
          <>
            <span className="font-numeric text-caption text-muted">{data.code}</span>
            <StatusText variant={statusVariant(data.lifecycleStatus)}>
              {statusLabel(data.lifecycleStatus)}
            </StatusText>
            <VendorTrustBadges
              isMsme={data.isMsme}
              lifecycleStatus={data.lifecycleStatus}
            />
          </>
        }
        description={
          [data.legalEntityName, category].filter(Boolean).join(' · ') || undefined
        }
        actions={
          data.lifecycleStatus === 'ACTIVE' && (canSuspend || canBlacklist) ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/vendors/${data.id}/suspend`}>
                {canSuspend && canBlacklist
                  ? 'Suspend or blacklist'
                  : canSuspend
                    ? 'Suspend'
                    : 'Blacklist'}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance scorecard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-numeric text-display font-semibold text-ink">
                  {sc.score === null ? 'N/A' : sc.score}
                </span>
                {/* A grade computed from under three transactions has not been
                    earned, so it does not keep a confident colour — the chip
                    drops to neutral and says "provisional". */}
                <ScorecardGradeChip grade={sc.grade} provisional={sc.insufficientData} />
              </div>
              <p className="mb-3 text-caption text-muted">
                {sc.transactionCount === 0
                  ? 'No scorecard yet — there are no transactions on record to grade.'
                  : sc.insufficientData
                    ? `Cold start — only ${sc.transactionCount} transaction${sc.transactionCount === 1 ? '' : 's'} on record. Treat this grade as indicative.`
                    : `Weighted across ${sc.transactionCount} transactions in the ${scorecardPeriod(sc.period)}.`}
              </p>

              <div className="grid gap-x-8 md:grid-cols-2">
                <div>
                  <MetricBar label="OTIF" value={sc.metrics.otifPct} suffix="%" scale />
                  <MetricBar
                    label="Quality"
                    value={sc.metrics.qualityPct}
                    suffix="%"
                    scale
                  />
                  <MetricBar
                    label="Dispute rate"
                    value={sc.metrics.disputeRatePct}
                    suffix="%"
                    scale
                    inverse
                  />
                  {/* Durations have no upper bound and no target in the API, so
                      they get a value and no bar rather than an invented
                      denominator. */}
                  <MetricBar
                    label="Response time"
                    value={sc.metrics.responseTimeAvgHrs}
                    suffix="h"
                  />
                </div>
                <div>
                  {/* No target exists for these two — a 45% win rate is a
                      healthy supplier, so they show magnitude without a verdict. */}
                  <MetricBar
                    label="RFQ participation"
                    value={sc.metrics.rfqParticipationPct}
                    suffix="%"
                    scale
                    tone="neutral"
                  />
                  <MetricBar
                    label="Win rate"
                    value={sc.metrics.winRatePct}
                    suffix="%"
                    scale
                    tone="neutral"
                  />
                  <MetricBar
                    label="Payment cycle"
                    value={sc.metrics.paymentCycleDays}
                    suffix="d"
                  />
                </div>
              </div>

              <dl className="mt-3 grid gap-x-8 border-t border-line pt-2 md:grid-cols-2">
                <Fact label="Transactions">
                  <span className="font-numeric">{sc.transactionCount}</span>
                </Fact>
                <Fact label="FYTD spend">
                  <span className="font-numeric">{inr(data.fytdSpend)}</span>
                </Fact>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {data.documents.length === 0 ? (
                <p className="text-body-sm text-muted">No documents on file.</p>
              ) : (
                <table className="pf-stack w-full text-body-sm">
                  <thead className="border-b border-line text-left text-muted">
                    <tr>
                      <th className="px-3 py-2.5 text-caption font-medium">Document</th>
                      <th className="px-3 py-2.5 text-caption font-medium">Number</th>
                      <th className="px-3 py-2.5 text-caption font-medium">Valid to</th>
                      <th className="px-3 py-2.5 text-caption font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.map((d) => (
                      <tr key={d.id} className="border-b border-line last:border-b-0">
                        <td className="px-3 py-3.5">
                          <div className="font-medium text-ink">
                            {humanise(d.docType)}
                          </div>
                          {d.url ? (
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-caption text-accent hover:text-accent-2 hover:underline"
                            >
                              {d.filename}
                            </a>
                          ) : (
                            <span className="text-caption text-faint">
                              {d.filename} (file unavailable)
                            </span>
                          )}
                        </td>
                        <td className="font-numeric px-3 py-3.5 text-muted">
                          {d.documentNumber ?? '—'}
                        </td>
                        <td className="font-numeric px-3 py-3.5 text-muted">
                          {d.validTo ? formatDate(d.validTo) : 'No expiry'}
                        </td>
                        <td className="px-3 py-3.5">
                          <StatusText
                            variant={DOC_VARIANT[d.verificationStatus] ?? 'neutral'}
                          >
                            {humanise(d.verificationStatus)}
                          </StatusText>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {data.suspensions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Lifecycle events</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="pf-stack w-full text-body-sm">
                  <thead className="border-b border-line text-left text-muted">
                    <tr>
                      <th className="px-3 py-2.5 text-caption font-medium">Action</th>
                      <th className="px-3 py-2.5 text-caption font-medium">Reason</th>
                      <th className="px-3 py-2.5 text-caption font-medium">Imposed</th>
                      <th className="px-3 py-2.5 text-caption font-medium">Lifted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.suspensions.map((s) => (
                      <tr key={s.id} className="border-b border-line last:border-b-0">
                        <td className="px-3 py-3.5">
                          <StatusText
                            variant={s.suspensionType === 'BLACKLIST' ? 'danger' : 'warn'}
                          >
                            {humanise(s.suspensionType)}
                          </StatusText>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="text-ink">{humanise(s.reasonCode)}</div>
                          <div className="text-caption text-muted">{s.reasonNotes}</div>
                        </td>
                        <td className="font-numeric px-3 py-3.5 text-muted">
                          {formatDate(s.imposedAt)}
                        </td>
                        <td className="font-numeric px-3 py-3.5 text-muted">
                          {s.liftedAt ? formatDate(s.liftedAt) : 'In force'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance & identity</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-line">
                <Fact label="Risk grade">
                  <span className="inline-flex items-center gap-2">
                    <RiskGradeChip grade={data.riskGrade} />
                    {/* The score without a grade has been seen in live data;
                        printing "Not assessed 87/100" contradicts itself. */}
                    {data.riskGrade && data.riskScore && (
                      <span className="font-numeric text-caption text-muted">
                        {data.riskScore}/100
                      </span>
                    )}
                  </span>
                </Fact>
                <Fact label="GSTIN">
                  <span className="font-numeric">{data.gstin ?? '—'}</span>
                </Fact>
                <Fact label="PAN">
                  <span className="font-numeric">{data.pan ?? '—'}</span>
                </Fact>
                <Fact label="Entity type">
                  {data.legalEntityType ? humanise(data.legalEntityType) : '—'}
                </Fact>
                {data.isMsme && (
                  <Fact label="MSME category">
                    {data.msmeCategory ? humanise(data.msmeCategory) : 'Not stated'}
                  </Fact>
                )}
                <Fact label="Activated">
                  <span className="font-numeric">
                    {data.activatedAt
                      ? formatDate(data.activatedAt)
                      : data.lifecycleStatus === 'ACTIVE'
                        ? 'Not recorded'
                        : 'Not yet'}
                  </span>
                </Fact>
              </dl>
              {tags.length > 0 && (
                <div className="mt-2 border-t border-line pt-3">
                  <p className="mb-1.5 text-caption text-muted">
                    Categories & capabilities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <Badge key={t} variant="neutral">
                        {/* Tags are free-form lowercase keys ("heat_treatment"),
                            which humanise leaves alone. */}
                        {t.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="text-body-sm">
              {data.primaryContact ? (
                <div className="space-y-0.5">
                  <div className="font-medium text-ink">{data.primaryContact.name}</div>
                  {data.primaryContact.email && (
                    <a
                      href={`mailto:${data.primaryContact.email}`}
                      className="block break-all text-accent hover:text-accent-2 hover:underline"
                    >
                      {data.primaryContact.email}
                    </a>
                  )}
                  {data.primaryContact.phone && (
                    <div className="font-numeric text-muted">
                      {data.primaryContact.phone}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted">No primary contact on file.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bank account</CardTitle>
            </CardHeader>
            <CardContent className="text-body-sm">
              {data.bank ? (
                <dl className="divide-y divide-line">
                  <Fact label="Bank">{data.bank.bankName}</Fact>
                  <Fact label="Account">
                    <span className="font-numeric">••••{data.bank.accountNoLast4}</span>
                  </Fact>
                  <Fact label="IFSC">
                    <span className="font-numeric">{data.bank.ifsc}</span>
                  </Fact>
                  <Fact label="Penny drop">
                    <StatusText variant={data.bank.verifiedAt ? 'success' : 'warn'}>
                      {data.bank.verifiedAt
                        ? `Verified ${formatDate(data.bank.verifiedAt)}`
                        : 'Not verified'}
                    </StatusText>
                  </Fact>
                </dl>
              ) : (
                <p className="text-muted">No bank account on file.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Shaped like the page it stands in for, so nothing jumps when data lands. */
function DetailSkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-3.5 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-line bg-panel p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="space-y-3 rounded-lg border border-line bg-panel p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-lg border border-line bg-panel p-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The scorecard window, in words. The API returns `ROLLING_90D` and it was
 * printed verbatim under a headline figure — a constant name is not an answer
 * to "over what period?".
 */
function scorecardPeriod(period: string): string {
  const m = /^ROLLING_(\d+)D$/.exec(period);
  if (m) return `last ${m[1]} days`;
  if (period === 'FYTD') return 'financial year to date';
  return humanise(period).toLowerCase();
}
