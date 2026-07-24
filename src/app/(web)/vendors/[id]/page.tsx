'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Pill } from '@/components/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useVendor360 } from '@/lib/api/vendors';
import { inr } from '@/lib/format';

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
  const { data, isLoading } = useVendor360(params.id);

  if (isLoading || !data) return <p className="text-muted p-6 text-[13px]">Loading…</p>;

  const sc = data.scorecard;

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-4">
        <Link href="/vendors" className="text-muted hover:text-ink text-[12px]">
          ← Vendors
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            {data.name}
          </h1>
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
            {data.lifecycleStatus.replace(/_/g, ' ')}
          </Pill>
          {data.isMsme && <Pill variant="info">MSME</Pill>}
        </div>
        <p className="text-muted text-[13px]">
          {data.legalEntityName} · {data.category ?? '—'}
        </p>
        <div className="mt-3 flex gap-2">
          {data.lifecycleStatus === 'ACTIVE' && (
            <Link href={`/vendors/${data.id}/suspend`}>
              <Button variant="default">Suspend / blacklist</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Scorecard */}
        <Card>
          <CardHeader>
            <CardTitle>Performance scorecard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-ink text-[28px] font-semibold tabular-nums">
                {sc.score === null ? 'N/A' : sc.score}
              </span>
              <Pill
                variant={
                  sc.grade.startsWith('A')
                    ? 'success'
                    : sc.grade === 'B'
                      ? 'warn'
                      : 'gray'
                }
              >
                {sc.grade}
              </Pill>
            </div>
            {sc.insufficientData && (
              <p className="text-muted mb-2 text-[12px]">
                Cold start — under 3 transactions.
              </p>
            )}
            {metricRow('OTIF', sc.metrics.otifPct, '%')}
            {metricRow('Quality', sc.metrics.qualityPct, '%')}
            {metricRow('Response time', sc.metrics.responseTimeAvgHrs, 'h')}
            {metricRow('Dispute rate', sc.metrics.disputeRatePct, '%')}
            {metricRow('RFQ participation', sc.metrics.rfqParticipationPct, '%')}
            {metricRow('Win rate', sc.metrics.winRatePct, '%')}
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
                {data.activatedAt ? new Date(data.activatedAt).toLocaleDateString() : '—'}
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
                  ••••{data.bank.accountNoLast4} · {data.bank.ifsc}
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
                    {new Date(s.imposedAt).toLocaleDateString()}
                    {s.liftedAt
                      ? ` · lifted ${new Date(s.liftedAt).toLocaleDateString()}`
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
