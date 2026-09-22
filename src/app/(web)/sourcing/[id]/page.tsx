'use client';

import { Badge, Button, DataState, PageHeader, Pill, StageStrip } from '@/components/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useRfq } from '@/lib/api/sourcing';
import {
  formatDateTime,
  humanise,
  inr,
  qty,
  statusLabel,
  statusVariant,
} from '@/lib/format';

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
        <div className="rounded-lg border border-line bg-panel">
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
        breadcrumbs={[{ label: 'Sourcing', href: '/sourcing' }, { label: rfq.number }]}
        meta={
          <>
            <span className="font-numeric text-caption text-muted">{rfq.number}</span>
            <Pill variant={statusVariant(rfq.status)} dot>
              {statusLabel(rfq.status)}
            </Pill>
            <Pill variant="neutral">{humanise(rfq.rfqType)}</Pill>
          </>
        }
        description={`${rfq.category}${rfq.subcategory ? `, ${rfq.subcategory}` : ''}`}
        actions={
          <>
            {rfq.isReverseAuction && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/sourcing/${id}/reverse-auction`}>Reverse auction</Link>
              </Button>
            )}
            {rfq.status === 'DRAFT' && (
              <Button asChild variant="primary" size="sm">
                <Link href={`/sourcing/${id}/publish`}>Publish</Link>
              </Button>
            )}
            {(rfq.status === 'BID_CLOSED' ||
              rfq.status === 'BIDDING_OPEN' ||
              rfq.status === 'TECH_OPEN') && (
              <Button asChild variant="primary" size="sm">
                <Link href={`/sourcing/${id}/open`}>Open ceremony</Link>
              </Button>
            )}
            {(rfq.status === 'COMMERCIAL_OPEN' || rfq.status === 'EVALUATION') && (
              <>
                {/* Secondary: Award is the decision this screen exists for, and
                    two filled buttons side by side answer neither "what next". */}
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/sourcing/${id}/evaluate`}>Evaluate</Link>
                </Button>
                <Button asChild variant="primary" size="sm">
                  <Link href={`/sourcing/${id}/award`}>Award</Link>
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-4 overflow-x-auto rounded-lg border border-line bg-panel p-3.5">
        <StageStrip
          stages={STAGES.map((st) => ({ key: st, label: statusLabel(st) }))}
          activeIndex={Math.max(0, stageIdx)}
          failed={rfq.status === 'CANCELLED'}
          failedLabel={statusLabel(rfq.status)}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="Lines" flush>
            <table className="pf-stack w-full text-body-sm">
              <thead className="border-b border-line text-left text-caption text-muted">
                <tr>
                  <th className="w-10 px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Item</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 font-medium">UOM</th>
                  <th className="px-3 py-2.5 font-medium">HSN</th>
                  <th className="px-3 py-2.5 text-right font-medium">Min split</th>
                </tr>
              </thead>
              <tbody>
                {rfq.lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted">
                      No lines on this RFQ.
                    </td>
                  </tr>
                )}
                {rfq.lines.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="font-numeric px-3 py-3.5 text-muted">{l.lineNo}</td>
                    <td className="px-3 py-3.5 text-text">{l.itemDesc}</td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {qty(l.qtyRequired, 2)}
                    </td>
                    <td className="px-3 py-3.5 text-muted">{l.uom}</td>
                    <td className="font-numeric px-3 py-3.5 text-caption text-muted">
                      {l.hsnCode ?? '—'}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {l.qtyMinSplit ? qty(l.qtyMinSplit, 2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Quote count summary (masked pre-open) */}
          <Section title="Quotes">
            <p className="text-body-sm">
              <span className="font-numeric text-h2 font-semibold text-ink">
                {rfq.submittedCount}
              </span>{' '}
              <span className="text-muted">of {rfq.invitedCount} vendors submitted</span>
            </p>
            <p className="mt-1 text-caption text-muted">
              Sealed — values and vendor rankings are hidden until the open ceremony.
            </p>
          </Section>

          {/* Invitations */}
          <Section title="Invitations" flush>
            <table className="pf-stack w-full text-body-sm">
              <thead className="border-b border-line text-left text-caption text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Vendor</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">MSME</th>
                  <th className="px-3 py-2.5 text-right font-medium">OTIF</th>
                  <th className="px-3 py-2.5 text-right font-medium">Quality</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rfq.invitations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted">
                      No vendors invited yet
                      {rfq.status === 'DRAFT' ? ' — add them when you publish.' : '.'}
                    </td>
                  </tr>
                )}
                {rfq.invitations.map((i) => (
                  <tr key={i.id} className="border-t border-line">
                    <td className="px-3 py-3.5 text-text">{i.vendorName}</td>
                    <td className="px-3 py-3.5 text-muted">{humanise(i.source)}</td>
                    <td className="px-3 py-3.5">
                      {i.isMsme ? <Badge variant="classification">MSME</Badge> : '—'}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {i.historicalOtif ?? '—'}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {i.historicalQuality ?? '—'}
                    </td>
                    <td className="px-3 py-3.5">
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
              <p className="text-body-sm text-muted">No questions yet.</p>
            )}
            {rfq.questions.map((q) => (
              <div key={q.id} className="border-t border-line py-2 first:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{q.isPublic ? 'Public' : 'Private'}</Badge>
                  <span className="text-caption text-muted">{q.vendorName}</span>
                </div>
                <p className="text-body-sm">{q.questionText}</p>
                {q.answerText && (
                  <p className="mt-1 border-l-2 border-line pl-2 text-body-sm text-muted">
                    {q.answerText}
                  </p>
                )}
              </div>
            ))}
          </Section>
        </div>

        {/* Right panel */}
        <div className="flex min-w-0 flex-col gap-4">
          <Section title="RFQ value">
            <p className="font-numeric text-h2 font-semibold text-ink">
              {inr(rfq.estimatedValue)}
            </p>
            <p className="text-caption text-muted">
              Incoterm {rfq.incotermDefault ?? '—'}, payment{' '}
              {rfq.paymentTermsDefault
                ? humanise(rfq.paymentTermsDefault).toLowerCase()
                : '—'}
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
                className="font-numeric text-caption text-accent hover:underline"
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
                  value={humanise(c.impact)}
                />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

/** A titled card. `flush` lets a table run edge to edge under the title. */
function Section({
  title,
  flush,
  children,
}: {
  title: string;
  flush?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={'rounded-lg border border-line bg-panel ' + (flush ? 'pt-4' : 'p-4')}>
      <h2 className={'mb-2 text-h3 font-semibold text-ink ' + (flush ? 'px-4' : '')}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-body-sm">
      <span className="min-w-0 text-muted">{label}</span>
      <span className="font-numeric shrink-0 text-right text-ink">{value}</span>
    </div>
  );
}

function fmt(iso: string | null): string {
  return formatDateTime(iso);
}
