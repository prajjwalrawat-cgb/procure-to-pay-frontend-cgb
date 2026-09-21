'use client';

import { Badge, Button, DataState, Input, PageHeader, Pill, ScoreBreakdown, TableState } from '@/components/ui';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fragment, useState } from 'react';

import { useAutoScore, useComparison, useEvaluate, useQualify } from '@/lib/api/sourcing';
import { inr } from '@/lib/format';
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
        <PageHeader title="Evaluation" />
        <div className="border-line bg-panel rounded-lg border">
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
            <Link href={`/sourcing/${id}/award`}>
              <Button variant="primary" size="sm">
                Award →
              </Button>
            </Link>
          </>
        }
      />

      {matrix.masked && (
        <p className="text-warn mb-3 text-body-sm">
          Commercial values are still sealed. Open the commercial envelope to reveal
          landed cost.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="border-line border-b text-left text-caption text-muted">
            <tr>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Scorecard</th>
              <th className="px-3 py-2">Compliance</th>
              <th className="px-3 py-2 text-right">Landed (INR)</th>
              <th className="px-3 py-2 text-right">Lead</th>
              {matrix.criteria.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right">
                  {c.label} ({c.weight}%)
                </th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Tech</th>
            </tr>
          </thead>
          <tbody>
            {/* An RFQ with no quotes yet rendered as a header row over nothing. */}
            <TableState
              colSpan={7 + matrix.criteria.length}
              isEmpty={matrix.rows.length === 0}
              empty={{
                title: 'No quotes to compare yet',
                detail:
                  'Quotes appear here once invited vendors submit and the envelope is opened.',
              }}
            />
            {matrix.rows.map((row) => (
              <Fragment key={row.quoteId}>
              <tr className="border-line border-b last:border-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {row.displayName}
                    {row.isMsme && <Badge variant="classification">MSME</Badge>}
                    {row.rankLabel && <Pill variant="success">{row.rankLabel}</Pill>}
                  </div>
                </td>
                <td className="text-muted px-3 py-2 text-caption">
                  OTIF {row.historicalOtif ?? '—'}, Q {row.historicalQuality ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <Pill variant={row.specCompliance === 'FULL' ? 'success' : 'warn'}>
                    {row.specCompliance ?? '—'}
                  </Pill>
                </td>
                <td className="font-numeric px-3 py-2 text-right">
                  {row.totalLandedInr ? inr(row.totalLandedInr) : '••••'}
                </td>
                <td className="font-numeric px-3 py-2 text-right">
                  {row.leadDays ?? '—'}d
                </td>
                {matrix.criteria.map((c) => {
                  const sc = row.scores.find((s) => s.criterion === c.key);
                  if (c.auto) {
                    return (
                      <td key={c.key} className="font-numeric px-3 py-2 text-right">
                        {sc?.rawScore ?? '—'}
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} className="px-3 py-2 text-right">
                      <Input
                        className="w-16 text-right"
                        value={manual[row.quoteId]?.[c.key] ?? sc?.rawScore ?? ''}
                        onChange={(e) =>
                          setManual((p) => ({
                            ...p,
                            [row.quoteId]: { ...p[row.quoteId], [c.key]: e.target.value },
                          }))
                        }
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right">
                  {/* The total is the expander: the number everyone acts on is
                      also the way into the maths behind it. */}
                  <button
                    type="button"
                    onClick={() =>
                      setOpenScore(openScore === row.quoteId ? null : row.quoteId)
                    }
                    aria-expanded={openScore === row.quoteId}
                    aria-label={`Show how ${row.displayName} scored ${row.weightedTotal ?? 'nothing yet'}`}
                    className="font-numeric text-ink hover:text-info duration-hover inline-flex items-center gap-1 font-semibold transition-colors"
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
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <button
                        className="text-accent-2 text-micro"
                        onClick={() =>
                          qualify.mutate({ quoteId: row.quoteId, decision: 'QUALIFIED' })
                        }
                      >
                        Qualify
                      </button>
                      <button
                        className="text-danger text-micro"
                        onClick={() =>
                          qualify.mutate({
                            quoteId: row.quoteId,
                            decision: 'DISQUALIFIED',
                            notes: 'Spec deviation',
                          })
                        }
                      >
                        Disqualify
                      </button>
                    </div>
                    <button
                      className="text-info text-micro"
                      onClick={() => saveManual(row.quoteId)}
                    >
                      Save scores
                    </button>
                  </div>
                </td>
              </tr>

              {openScore === row.quoteId && (
                <tr className="border-line bg-canvas/50 border-b">
                  <td colSpan={7 + matrix.criteria.length} className="px-3 py-3">
                    <div className="max-w-xl">
                      <ScoreBreakdown
                        criteria={matrix.criteria}
                        scores={row.scores}
                        total={row.weightedTotal}
                      />
                      <p className="text-faint mt-2 text-micro">
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
    </div>
  );
}
