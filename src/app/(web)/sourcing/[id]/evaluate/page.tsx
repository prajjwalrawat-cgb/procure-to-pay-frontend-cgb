'use client';

import {
  Badge,
  Button,
  DataState,
  EmptyState,
  Input,
  PageHeader,
  Pill,
  ScoreBreakdown,
} from '@/components/ui';
import { ChevronDown, Scale } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fragment, useState } from 'react';

import { useAutoScore, useComparison, useEvaluate, useQualify } from '@/lib/api/sourcing';
import { humanise, inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

/** Evaluation workspace: comparison matrix, auto-score, qualify, manual scoring. */
export default function EvaluatePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const toast = useToastStore((s) => s.push);
  const { data: matrix, isLoading, error, refetch } = useComparison(id);
  const autoScore = useAutoScore(id);
  const qualify = useQualify(id);
  const evaluate = useEvaluate(id);
  const [manual, setManual] = useState<Record<string, Record<string, string>>>({});
  // Which quote has its scoring maths expanded.
  const [openScore, setOpenScore] = useState<string | null>(null);

  if (isLoading || error || !matrix) {
    return (
      <div>
        <PageHeader
          title="Evaluation"
          breadcrumbs={[
            { label: 'Sourcing', href: '/sourcing' },
            { label: 'RFQ', href: `/sourcing/${id}` },
            { label: 'Evaluation' },
          ]}
        />
        <div className="rounded-lg border border-line bg-panel">
          <DataState
            isLoading={isLoading}
            error={error}
            isEmpty={!matrix}
            onRetry={() => void refetch()}
            empty={{
              title: 'No comparison available',
              detail: 'Quotes must be received before this RFQ can be evaluated.',
            }}
          >
            {null}
          </DataState>
        </div>
      </div>
    );
  }

  const manualCriteria = matrix.criteria.filter((c) => !c.auto);

  const saveManual = (quoteId: string): void => {
    const scores = manualCriteria
      .map((c) => ({
        criterion: c.key,
        rawScore: Number(manual[quoteId]?.[c.key] ?? '0'),
      }))
      .filter((s) => !Number.isNaN(s.rawScore));
    evaluate.mutate(
      { quoteId, input: { scores } },
      {
        onSuccess: () => toast('Scores saved', 'success'),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Evaluation"
        breadcrumbs={[
          { label: 'Sourcing', href: '/sourcing' },
          { label: 'RFQ', href: `/sourcing/${id}` },
          { label: 'Evaluation' },
        ]}
        description="Weighted comparison across every qualified quote. Expand a row to see how its total was built."
        actions={
          <>
            {/* Secondary: auto-scoring is a convenience on the way to the
                decision, and Award is the decision. */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                autoScore.mutate(undefined, {
                  onSuccess: (r) => toast(`Auto-scored ${r.scored} quotes`, 'success'),
                  onError: (e) => toast(e.message, 'error'),
                })
              }
              disabled={autoScore.isPending || matrix.masked}
            >
              Auto-score price + delivery
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link href={`/sourcing/${id}/award`}>Award</Link>
            </Button>
          </>
        }
      />

      {matrix.masked && (
        <p
          role="status"
          className="mb-3 rounded-sm bg-warn-bg px-3 py-2 text-caption text-warn"
        >
          Commercial values are still sealed. Open the commercial envelope to reveal
          landed cost.
        </p>
      )}

      {/* With no quotes the empty state stands on its own: inside the wide
          grid it sat off-screen to the right on a phone. */}
      {matrix.rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-panel">
          <EmptyState
            icon={Scale}
            title="No quotes to compare yet"
            detail="Quotes appear here once invited vendors submit and the envelope is opened."
          />
        </div>
      ) : (
        /* An editable grid (manual scores), so it scrolls inside itself on a
         phone rather than stacking into cards. */
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-body-sm">
            <thead className="border-b border-line text-left text-caption text-muted">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium">Vendor</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium">Scorecard</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium">Compliance</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
                  Landed (INR)
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
                  Lead
                </th>
                {matrix.criteria.map((c) => (
                  <th
                    key={c.key}
                    className="whitespace-nowrap px-3 py-2.5 text-right font-medium"
                  >
                    {c.label} ({c.weight}%)
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 text-right font-medium">
                  Total
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <Fragment key={row.quoteId}>
                  <tr className="border-b border-line last:border-0">
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {row.displayName}
                        {row.isMsme && <Badge variant="classification">MSME</Badge>}
                        {row.rankLabel && <Pill variant="success">{row.rankLabel}</Pill>}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-caption text-muted">
                      OTIF {row.historicalOtif ?? '—'}, Q {row.historicalQuality ?? '—'}
                    </td>
                    <td className="px-3 py-3.5">
                      <Pill variant={row.specCompliance === 'FULL' ? 'success' : 'warn'}>
                        {row.specCompliance ? humanise(row.specCompliance) : '—'}
                      </Pill>
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {row.totalLandedInr ? inr(row.totalLandedInr) : '••••'}
                    </td>
                    <td className="font-numeric px-3 py-3.5 text-right">
                      {row.leadDays ?? '—'}d
                    </td>
                    {matrix.criteria.map((c) => {
                      const sc = row.scores.find((s) => s.criterion === c.key);
                      if (c.auto) {
                        return (
                          <td key={c.key} className="font-numeric px-3 py-3.5 text-right">
                            {sc?.rawScore ?? '—'}
                          </td>
                        );
                      }
                      return (
                        <td key={c.key} className="px-3 py-3.5 text-right">
                          <Input
                            className="w-16 text-right"
                            value={manual[row.quoteId]?.[c.key] ?? sc?.rawScore ?? ''}
                            onChange={(e) =>
                              setManual((p) => ({
                                ...p,
                                [row.quoteId]: {
                                  ...p[row.quoteId],
                                  [c.key]: e.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-3.5 text-right">
                      {/* The total is the expander: the number everyone acts on is
                      also the way into the maths behind it. */}
                      <button
                        type="button"
                        onClick={() =>
                          setOpenScore(openScore === row.quoteId ? null : row.quoteId)
                        }
                        aria-expanded={openScore === row.quoteId}
                        aria-label={`Show how ${row.displayName} scored ${row.weightedTotal ?? 'nothing yet'}`}
                        className="font-numeric inline-flex items-center gap-1 font-semibold text-ink transition-colors duration-hover hover:text-info"
                      >
                        {row.weightedTotal ?? '—'}
                        <ChevronDown
                          className={
                            'h-3 w-3 transition-transform ' +
                            (openScore === row.quoteId ? 'rotate-180' : '')
                          }
                          aria-hidden
                        />
                      </button>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              qualify.mutate(
                                { quoteId: row.quoteId, decision: 'QUALIFIED' },
                                { onError: (e) => toast(e.message, 'error') },
                              )
                            }
                          >
                            Qualify
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              qualify.mutate(
                                {
                                  quoteId: row.quoteId,
                                  decision: 'DISQUALIFIED',
                                  notes: 'Spec deviation',
                                },
                                { onError: (e) => toast(e.message, 'error') },
                              )
                            }
                          >
                            Disqualify
                          </Button>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => saveManual(row.quoteId)}
                        >
                          Save scores
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {openScore === row.quoteId && (
                    <tr className="border-b border-line bg-canvas/50">
                      <td colSpan={7 + matrix.criteria.length} className="px-3 py-3">
                        <div className="max-w-xl">
                          <ScoreBreakdown
                            criteria={matrix.criteria}
                            scores={row.scores}
                            total={row.weightedTotal}
                          />
                          <p className="mt-2 text-caption text-muted">
                            Price is auto-scored as (lowest landed cost ÷ this landed
                            cost) × 100
                            {row.isMsme && ', plus the MSME purchase-preference boost'}.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
