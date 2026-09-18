'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataState,
  MetricBar,
  PageHeader,
  Pill,
} from '@/components/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useVendor360 } from '@/lib/api/vendors';
import { formatDate, humanise, inr, statusLabel } from '@/lib/format';

function metricRow(label: string, value: number | null, suffix = ''): React.JSX.Element {
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="text-ink tabular-nums">
        {value === null ? '—' : `${value}${suffix}`}
      </span>
    </div>
  );
}

export default function Vendor360Page(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useVendor360(params.id);

  if (isLoading || error || !data) {
    return (
      <div className="max-w-[1200px]">
        <PageHeader title="Vendor" />
        <div className="border-line bg-panel rounded-lg border">
          <DataState
            isLoading={isLoading}
            error={error}
            isEmpty={!data}
            onRetry={() => void refetch()}
            empty={{ title: 'Vendor not found' }}
          >
            {null}
          </DataState>
        </div>
      </div>
    );
  }

  const sc = data.scorecard;

  return (
    <div className="max-w-[1200px]">
      <PageHeader
        title={data.name}
        breadcrumbs={[{ label: 'Vendors', href: '/vendors' }, { label: data.name }]}
        meta={
          <>
            <Pill variant="gray">{data.code}</Pill>
            <Pill
              variant={
                data.lifecycleStatus === 'ACTIVE'
                  ? 'success'
                  : data.lifecycleStatus === 'BLACKLISTED'
                    ? 'danger'
                    : 'warn'
              }
            >
              {statusLabel(data.lifecycleStatus)}
            </Pill>
            {data.isMsme && <Pill variant="info">MSME</Pill>}
          </>
        }
        description={
          [data.legalEntityName, data.category ? humanise(data.category) : null]
            .filter(Boolean)
            .join(', ') || undefined
        }
        actions={
          data.lifecycleStatus === 'ACTIVE' ? (
            <Link href={`/vendors/${data.id}/suspend`}>
              <Button variant="default" size="sm">
                Suspend / blacklist
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Scorecard */}
        <Card>
          <CardHeader>
            <CardTitle>Performance scorecard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-1 flex flex-wrap items-baseline gap-2">
              <span className="font-numeric text-ink text-[28px] font-semibold">
                {sc.score === null ? 'N/A' : sc.score}
              </span>
              {/* A grade computed from under three transactions has not been
                  earned, so it does not keep a confident colour — the same
                  rule the sandbox verdicts follow. The caveat existed before
                  but sat beside a green pill, which is what people read. */}
              <Pill
                variant={
                  sc.insufficientData
                    ? 'outline'
                    : sc.grade.startsWith('A')
                      ? 'success'
                      : sc.grade === 'B'
                        ? 'warn'
                        : 'gray'
                }
              >
                {sc.grade}
              </Pill>
              {sc.insufficientData && (
                <span className="border-warn/35 bg-warn-wash text-warn rounded-xs border px-1.5 py-0.5 text-[10px] font-semibold ">
                  Provisional
                </span>
              )}
            </div>
            <p className="text-faint mb-2 text-[11px]">
              {sc.insufficientData
                ? `Cold start — only ${sc.transactionCount} transaction${sc.transactionCount === 1 ? '' : 's'} on record. Treat this grade as indicative.`
                : `Weighted across ${sc.transactionCount} transactions in the ${scorecardPeriod(sc.period)}.`}
            </p>

            <MetricBar label="OTIF" value={sc.metrics.otifPct} suffix="%" scale />
            <MetricBar label="Quality" value={sc.metrics.qualityPct} suffix="%" scale />
            <MetricBar
              label="Dispute rate"
              value={sc.metrics.disputeRatePct}
              suffix="%"
              scale
              inverse
            />
            {/* No target exists for these two — a 45% win rate is a healthy
                supplier, so they show magnitude without a verdict. */}
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
            {/* Durations have no upper bound and no target in the API, so they
                get a value and no bar rather than an invented denominator. */}
            <MetricBar
              label="Response time"
              value={sc.metrics.responseTimeAvgHrs}
              suffix="h"
            />
            <MetricBar
              label="Payment cycle"
              value={sc.metrics.paymentCycleDays}
              suffix="d"
            />
            <div className="border-line mt-2 border-t pt-2">
              {metricRow('Transactions', sc.transactionCount)}
              <div className="flex justify-between text-[13px]">
                <span className="text-muted">FYTD spend</span>
                <span className="text-ink tabular-nums">{inr(data.fytdSpend)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk + identity */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance & identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Risk grade</span>
              <Pill
                variant={
                  data.riskGrade === 'A' || data.riskGrade === 'B'
                    ? 'success'
                    : data.riskGrade
                      ? 'warn'
                      : 'gray'
                }
              >
                {data.riskGrade ?? '—'} {data.riskScore ? `(${data.riskScore})` : ''}
              </Pill>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">GSTIN</span>
              <span className="text-ink">{data.gstin ?? '—'}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">PAN</span>
              <span className="text-ink">{data.pan ?? '—'}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Entity type</span>
              <span className="text-ink">{data.legalEntityType ?? '—'}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Activated</span>
              <span className="text-ink">
                {data.activatedAt ? formatDate(data.activatedAt) : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Contact + bank */}
        <Card>
          <CardHeader>
            <CardTitle>Contact & bank</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[13px]">
            {data.primaryContact ? (
              <>
                <div className="text-ink font-medium">{data.primaryContact.name}</div>
                <div className="text-muted">{data.primaryContact.email}</div>
                <div className="text-muted">{data.primaryContact.phone ?? ''}</div>
              </>
            ) : (
              <p className="text-muted">No primary contact.</p>
            )}
            {data.bank && (
              <div className="border-line mt-2 border-t pt-2">
                <div className="text-ink">{data.bank.bankName}</div>
                <div className="text-muted">
                  ••••{data.bank.accountNoLast4}, {data.bank.ifsc}
                </div>
                <Pill variant={data.bank.verifiedAt ? 'success' : 'warn'}>
                  {data.bank.verifiedAt ? 'Penny-drop verified' : 'Unverified'}
                </Pill>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suspensions history */}
      {data.suspensions.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Lifecycle events</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-[13px]">
              {data.suspensions.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span className="text-ink">
                    <Pill variant={s.suspensionType === 'BLACKLIST' ? 'danger' : 'warn'}>
                      {s.suspensionType}
                    </Pill>{' '}
                    <span className="text-muted">{s.reasonCode.replace(/_/g, ' ')}</span>{' '}
                    — {s.reasonNotes}
                  </span>
                  <span className="text-muted">
                    {formatDate(s.imposedAt)}
                    {s.liftedAt
                      ? `, lifted ${formatDate(s.liftedAt)}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
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
