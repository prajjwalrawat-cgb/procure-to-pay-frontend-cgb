'use client';

import { Button, Input, Pill } from '@procureflow/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { useAutoScore, useComparison, useEvaluate, useQualify } from '@/lib/api/sourcing';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

/** Evaluation workspace: comparison matrix, auto-score, qualify, manual scoring. */
export default function EvaluatePage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const toast = useToastStore((s) => s.push);
  const { data: matrix, isLoading } = useComparison(id);
  const autoScore = useAutoScore(id);
  const qualify = useQualify(id);
  const evaluate = useEvaluate(id);
  const [manual, setManual] = useState<Record<string, Record<string, string>>>({});

  if (isLoading || !matrix)
    return <div className="text-muted p-8 text-center">Loading…</div>;

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
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          Evaluation
        </h1>
        <div className="flex gap-2">
          <Button
            variant="accent"
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
            <Button variant="primary">Award →</Button>
          </Link>
        </div>
      </div>

      {matrix.masked && (
        <p className="text-warn mb-3 text-[13px]">
          Commercial values are still sealed. Open the commercial envelope to reveal
          landed cost.
        </p>
      )}

      <div className="border-line bg-panel overflow-x-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <thead className="text-muted border-line border-b text-left">
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
            {matrix.rows.map((row) => (
              <tr key={row.quoteId} className="border-line border-b last:border-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {row.displayName}
                    {row.isMsme && <Pill variant="violet">MSME</Pill>}
                    {row.rankLabel && <Pill variant="success">{row.rankLabel}</Pill>}
                  </div>
                </td>
                <td className="text-muted px-3 py-2 text-[12px]">
                  OTIF {row.historicalOtif ?? '—'} · Q {row.historicalQuality ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <Pill variant={row.specCompliance === 'FULL' ? 'success' : 'warn'}>
                    {row.specCompliance ?? '—'}
                  </Pill>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {row.totalLandedInr ? inr(row.totalLandedInr) : '••••'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.leadDays ?? '—'}d
                </td>
                {matrix.criteria.map((c) => {
                  const sc = row.scores.find((s) => s.criterion === c.key);
                  if (c.auto) {
                    return (
                      <td key={c.key} className="px-3 py-2 text-right tabular-nums">
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
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {row.weightedTotal ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <button
                        className="text-accent-2 text-[11px]"
                        onClick={() =>
                          qualify.mutate({ quoteId: row.quoteId, decision: 'QUALIFIED' })
                        }
                      >
                        Qualify
                      </button>
                      <button
                        className="text-danger text-[11px]"
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
                      className="text-info text-[11px]"
                      onClick={() => saveManual(row.quoteId)}
                    >
                      Save scores
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
