'use client';

import { Badge, Button, DataState, PageHeader, Pill, StageStrip } from '@/components/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useRfq } from '@/lib/api/sourcing';
import { formatDateTime, inr, statusLabel, statusVariant } from '@/lib/format';

const STAGES = [
  'DRAFT',
  'PUBLISHED',
  'Q_AND_A_OPEN',
  'BIDDING_OPEN',
  'TECH_OPEN',
  'COMMERCIAL_OPEN',
  'EVALUATION',
  'AWARD_PENDING',
  'AWARDED',
];

export default function RfqDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { data: rfq, isLoading, error, refetch } = useRfq(id);

  if (isLoading || error || !rfq) {
    return (
      <div>
        <PageHeader title="RFQ" />
        <div className="border-line bg-panel rounded-lg border">
          <DataState
            isLoading={isLoading}
            error={error}
            isEmpty={!rfq}
            onRetry={() => void refetch()}
            empty={{ title: 'RFQ not found' }}
          >
            {null}
          </DataState>
        </div>
      </div>
    );
  }

  const stageIdx = STAGES.indexOf(rfq.status);

  return (
    <div>
      <PageHeader
        title={rfq.title}
        breadcrumbs={[
          { label: 'Sourcing', href: '/sourcing' },
          { label: rfq.number },
        ]}
        meta={
          <>
            <span className="font-numeric text-muted text-caption">{rfq.number}</span>
            <Pill variant={statusVariant(rfq.status)} dot>
              {statusLabel(rfq.status)}
            </Pill>
            <Pill variant="gray">{rfq.rfqType.replace(/_/g, ' ').toLowerCase()}</Pill>
          </>
        }
        description={`${rfq.category}${rfq.subcategory ? `, ${rfq.subcategory}` : ''}`}
        actions={
          <>
          {rfq.status === 'DRAFT' && (
            <Link href={`/sourcing/${id}/publish`}>
              <Button variant="primary" size="sm">Publish</Button>
            </Link>
          )}
          {(rfq.status === 'BID_CLOSED' ||
            rfq.status === 'BIDDING_OPEN' ||
            rfq.status === 'TECH_OPEN') && (
            <Link href={`/sourcing/${id}/open`}>
              <Button variant="primary" size="sm">Open ceremony</Button>
            </Link>
          )}
          {(rfq.status === 'COMMERCIAL_OPEN' || rfq.status === 'EVALUATION') && (
            <>
              <Link href={`/sourcing/${id}/evaluate`}>
                {/* Secondary: Award is the decision this screen exists for, and
                    two filled buttons side by side answer neither "what next". */}
                <Button variant="secondary" size="sm">Evaluate</Button>
              </Link>
              <Link href={`/sourcing/${id}/award`}>
                <Button variant="primary" size="sm">Award</Button>
              </Link>
            </>
          )}
          {rfq.isReverseAuction && (
            <Link href={`/sourcing/${id}/reverse-auction`}>
              <Button variant="ghost" size="sm">
                Reverse auction
              </Button>
            </Link>
          )}
          </>
        }
      />

      <div className="border-line bg-panel mb-4 rounded-lg border p-3.5">
        <StageStrip
          stages={STAGES.map((st) => ({ key: st, label: statusLabel(st) }))}
          activeIndex={Math.max(0, stageIdx)}
          failed={rfq.status === 'CANCELLED'}
          failedLabel={statusLabel(rfq.status)}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* Lines */}
          <Section title="Lines">
            <table className="w-full text-body-sm">
              <thead className="border-line border-b text-left text-caption text-muted">
                <tr>
                  <th className="py-1">#</th>
                  <th className="py-1">Item</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1">UOM</th>
                  <th className="py-1">HSN</th>
                  <th className="py-1 text-right">Min split</th>
                </tr>
              </thead>
              <tbody>
                {rfq.lines.map((l) => (
                  <tr key={l.id} className="border-line border-t">
                    <td className="py-1">{l.lineNo}</td>
                    <td className="py-1">{l.itemDesc}</td>
                    <td className="py-1 text-right tabular-nums">{l.qtyRequired}</td>
                    <td className="py-1">{l.uom}</td>
                    <td className="py-1 font-mono text-caption">{l.hsnCode ?? '—'}</td>
                    <td className="py-1 text-right tabular-nums">{l.qtyMinSplit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Quote count summary (masked pre-open) */}
          <Section title="Quotes">
            <p className="text-body-sm">
              <span className="text-ink text-h2 font-semibold tabular-nums">
                {rfq.submittedCount}
              </span>{' '}
              <span className="text-muted">of {rfq.invitedCount} vendors submitted</span>
            </p>
            <p className="text-faint mt-1 text-caption">
              Sealed — values &amp; vendor rankings are hidden until the open ceremony.
            </p>
          </Section>

          {/* Invitations */}
          <Section title="Invitations">
            <table className="w-full text-body-sm">
              <thead className="border-line border-b text-left text-caption text-muted">
                <tr>
                  <th className="py-1">Vendor</th>
                  <th className="py-1">Source</th>
                  <th className="py-1">MSME</th>
                  <th className="py-1">OTIF</th>
                  <th className="py-1">Quality</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {rfq.invitations.map((i) => (
                  <tr key={i.id} className="border-line border-t">
                    <td className="py-1">{i.vendorName}</td>
                    <td className="text-muted py-1">{i.source.toLowerCase()}</td>
                    <td className="py-1">
                      {i.isMsme ? <Badge variant="classification">MSME</Badge> : '—'}
                    </td>
                    <td className="py-1 tabular-nums">{i.historicalOtif ?? '—'}</td>
                    <td className="py-1 tabular-nums">{i.historicalQuality ?? '—'}</td>
                    <td className="py-1">
                      <Pill variant={statusVariant(i.status)}>
                        {statusLabel(i.status)}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Q&A */}
          <Section title={`Q&A (${rfq.questions.length})`}>
            {rfq.questions.length === 0 && (
              <p className="text-muted text-body-sm">No questions yet.</p>
            )}
            {rfq.questions.map((q) => (
              <div key={q.id} className="border-line border-t py-2 first:border-0">
                <div className="flex items-center gap-2">
                  <Pill variant={q.isPublic ? 'info' : 'gray'}>
                    {q.isPublic ? 'public' : 'private'}
                  </Pill>
                  <span className="text-muted text-caption">{q.vendorName}</span>
                </div>
                <p className="text-body-sm">{q.questionText}</p>
                {q.answerText && (
                  <p className="text-accent-2 mt-1 text-body-sm">↳ {q.answerText}</p>
                )}
              </div>
            ))}
          </Section>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <Section title="RFQ value">
            <p className="text-ink text-h2 font-semibold tabular-nums">
              {inr(rfq.estimatedValue)}
            </p>
            <p className="text-muted text-caption">
              INCOTERM {rfq.incotermDefault}, {rfq.paymentTermsDefault}
            </p>
          </Section>

          <Section title="Timing (IST)">
            <Row label="Q&A deadline" value={fmt(rfq.qaDeadline)} />
            <Row label="Bid deadline" value={fmt(rfq.bidDeadline)} />
            <Row label="Tech open" value={fmt(rfq.techOpenAt)} />
            <Row label="Commercial open" value={fmt(rfq.commercialOpenAt)} />
            <Row label="Award deadline" value={fmt(rfq.awardDeadline)} />
          </Section>

          <Section title="Evaluation criteria">
            {rfq.evaluationCriteria.map((c) => (
              <Row key={c.key} label={c.label} value={`${c.weight}%`} />
            ))}
          </Section>

          {rfq.requisitionNumber && (
            <Section title="Linked PR">
              <Link
                href={`/requisitions/${rfq.requisitionId}`}
                className="text-accent font-mono text-caption"
              >
                {rfq.requisitionNumber}
              </Link>
            </Section>
          )}

          {rfq.corrigenda.length > 0 && (
            <Section title="Corrigenda">
              {rfq.corrigenda.map((c) => (
                <Row
                  key={c.id}
                  label={`#${c.number} ${c.title}`}
                  value={c.impact.toLowerCase()}
                />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-3">
      <h2 className="text-muted mb-2 text-caption font-semibold ">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex justify-between py-0.5 text-body-sm">
      <span className="text-muted">{label}</span>
      <span className="text-ink tabular-nums">{value}</span>
    </div>
  );
}

function fmt(iso: string | null): string {
  return formatDateTime(iso);
}
