'use client';

import {
  Badge,
  Button,
  DataState,
  Input,
  PageHeader,
  Pill,
  ScoreBreakdown,
  Textarea,
  controlClass,
} from '@/components/ui';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Fragment, useMemo, useState } from 'react';
import type { AwardAllocationInput } from '@/lib/shared';

import { useComparison, useRecommendAward, useSubmitAward } from '@/lib/api/sourcing';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

interface AllocRow {
  quoteId: string;
  rfqLineId: string;
  qtyAllocated: string;
  unitPrice: string;
}

/** The engine requires a written justification when the award is not the L1 quote. */
const VARIANCE_MIN_CHARS = 500;

const selectClass = controlClass;

/** Award recommendation: line-by-line allocation, L1-variance justification. */
export default function AwardPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data: matrix, isLoading, error, refetch } = useComparison(id);
  const recommend = useRecommendAward(id);
  const submit = useSubmitAward(id);

  const [rows, setRows] = useState<AllocRow[]>([]);
  const [variance, setVariance] = useState('');
  const [notes, setNotes] = useState('');
  const [openScore, setOpenScore] = useState<string | null>(null);

  // The lowest-ranked quote. Awarding away from it is what triggers the
  // justification requirement, so it is worth naming rather than inferring.
  const l1 = useMemo(() => matrix?.rows.find((r) => r.rank === 1) ?? null, [matrix]);

  /**
   * Surfacing the rule instead of letting the server reject the submission:
   * any allocation to a quote other than L1 needs the written justification.
   */
  const awardsAwayFromL1 = rows.some((r) => r.quoteId && r.quoteId !== l1?.quoteId);
  const varianceShort = awardsAwayFromL1 && variance.trim().length < VARIANCE_MIN_CHARS;
  const incomplete = rows.some(
    (r) => !r.quoteId || !r.rfqLineId || !r.qtyAllocated || !r.unitPrice,
  );
  const canSubmit =
    rows.length > 0 &&
    !incomplete &&
    !varianceShort &&
    !recommend.isPending &&
    !submit.isPending;

  const patch = (i: number, next: Partial<AllocRow>): void =>
    setRows((p) => p.map((x, j) => (j === i ? { ...x, ...next } : x)));

  const addRow = (): void => {
    if (!matrix) return;
    setRows((p) => [
      ...p,
      {
        // Default to L1 — the common case is awarding the lowest quote, and
        // pre-selecting it keeps the justification requirement off.
        quoteId: l1?.quoteId ?? matrix.rows[0]?.quoteId ?? '',
        rfqLineId: matrix.lines[0]?.id ?? '',
        qtyAllocated: '',
        unitPrice: '',
      },
    ]);
  };

  const submitAward = (): void => {
    const allocations: AwardAllocationInput[] = rows.map((r) => ({
      quoteId: r.quoteId,
      rfqLineId: r.rfqLineId,
      qtyAllocated: r.qtyAllocated || '0',
      unitPrice: r.unitPrice || '0',
    }));
    recommend.mutate(
      { allocations, notes: notes || null, varianceFromL1Reason: variance || null },
      {
        onSuccess: (a) => {
          submit.mutate(a.id, {
            onSuccess: () => {
              toast('Award submitted for approval', 'success');
              router.push(`/sourcing/${id}`);
            },
            onError: (e) => toast(e.message, 'error'),
          });
        },
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  if (isLoading || error || !matrix) {
    return (
      <div>
        <PageHeader
          title="Award recommendation"
          breadcrumbs={[
            { label: 'Sourcing', href: '/sourcing' },
            { label: 'Evaluation', href: `/sourcing/${id}/evaluate` },
            { label: 'Award' },
          ]}
        />
        <div className="rounded-lg border border-line bg-panel">
          <DataState
            isLoading={isLoading}
            error={error}
            isEmpty={!matrix}
            onRetry={() => void refetch()}
            empty={{
              title: 'Nothing to award',
              detail: 'This RFQ has no evaluated quotes yet.',
            }}
          >
            {null}
          </DataState>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl pb-8">
      <PageHeader
        title="Award recommendation"
        description="Allocate quantity per line, then submit for approval. Awarding away from the lowest quote requires a written justification."
        breadcrumbs={[
          { label: 'Sourcing', href: '/sourcing' },
          { label: 'Evaluation', href: `/sourcing/${id}/evaluate` },
          { label: 'Award' },
        ]}
      />

      {/* Quotes — the same weighted maths as the evaluation matrix, so the
          recommendation can be justified without navigating away. */}
      <section className="mb-4 rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-2 text-h3 font-semibold text-ink">Quotes</h2>
        <div className="overflow-x-auto">
          <table className="pf-stack w-full text-body-sm">
            <thead className="border-b border-line text-left text-caption text-muted">
              <tr>
                <th className="py-2.5 pr-3 font-medium">Vendor</th>
                <th className="px-3 py-2.5 text-right font-medium">Landed (INR)</th>
                <th className="py-2.5 pl-3 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-body-sm text-muted">
                    No quotes received yet. An award needs at least one opened quote.
                  </td>
                </tr>
              )}
              {matrix.rows.map((r) => (
                <Fragment key={r.quoteId}>
                  <tr className="border-t border-line">
                    <td className="py-3 pr-3">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-text">{r.displayName}</span>
                        {r.isMsme && <Badge variant="classification">MSME</Badge>}
                        {r.rankLabel && (
                          <Pill variant={r.rank === 1 ? 'success' : 'neutral'}>
                            {r.rankLabel}
                          </Pill>
                        )}
                      </span>
                    </td>
                    <td className="font-numeric px-3 py-3 text-right">
                      {r.totalLandedInr ? inr(r.totalLandedInr) : '—'}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenScore(openScore === r.quoteId ? null : r.quoteId)
                        }
                        aria-expanded={openScore === r.quoteId}
                        aria-label={`Show how ${r.displayName} scored`}
                        className="font-numeric inline-flex items-center gap-1 font-semibold text-ink transition-colors duration-hover hover:text-info"
                      >
                        {r.weightedTotal ?? '—'}
                        <ChevronDown
                          className={
                            'h-3 w-3 transition-transform ' +
                            (openScore === r.quoteId ? 'rotate-180' : '')
                          }
                          aria-hidden
                        />
                      </button>
                    </td>
                  </tr>
                  {openScore === r.quoteId && (
                    <tr className="bg-canvas/50">
                      <td colSpan={3} className="py-3">
                        <div className="max-w-lg">
                          <ScoreBreakdown
                            criteria={matrix.criteria}
                            scores={r.scores}
                            total={r.weightedTotal}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Allocation. These were free-text quoteId / rfqLineId boxes — unusable,
          since both are ULIDs nobody can type. They are now pickers over the
          quotes and lines this RFQ actually has. */}
      <section className="mb-4 rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-2 text-h3 font-semibold text-ink">Allocation</h2>

        {rows.length === 0 && (
          <p className="mb-2 text-caption text-muted">
            No allocations yet. Add one per RFQ line you are awarding.
          </p>
        )}

        {rows.map((r, i) => {
          const line = matrix.lines.find((l) => l.id === r.rfqLineId);
          return (
            <div
              key={i}
              className="mb-3 grid grid-cols-1 gap-2 border-b border-line pb-3 last:border-0 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_7.5rem_auto]"
            >
              <label className="flex flex-col gap-1">
                <span className="text-caption font-medium text-text">Vendor</span>
                <select
                  className={selectClass + ' pr-8'}
                  value={r.quoteId}
                  onChange={(e) => patch(i, { quoteId: e.target.value })}
                >
                  {matrix.rows.map((q) => (
                    <option key={q.quoteId} value={q.quoteId}>
                      {q.displayName}
                      {q.rankLabel ? `, ${q.rankLabel}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-caption font-medium text-text">RFQ line</span>
                <select
                  className={selectClass + ' pr-8'}
                  value={r.rfqLineId}
                  onChange={(e) => patch(i, { rfqLineId: e.target.value })}
                >
                  {matrix.lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lineNo}. {l.itemDesc}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-caption font-medium text-text">
                  Qty{line ? ` of ${line.qtyRequired} ${line.uom}` : ''}
                </span>
                <Input
                  inputMode="decimal"
                  value={r.qtyAllocated}
                  onChange={(e) => patch(i, { qtyAllocated: e.target.value })}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-caption font-medium text-text">Unit price</span>
                <Input
                  inputMode="decimal"
                  value={r.unitPrice}
                  onChange={(e) => patch(i, { unitPrice: e.target.value })}
                />
              </label>

              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove allocation ${i + 1}`}
                  onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}

        <Button variant="secondary" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add allocation
        </Button>
      </section>

      <section className="mb-4 rounded-lg border border-line bg-panel p-4">
        <label className="mb-3 block">
          <span className="mb-1 block text-caption font-medium text-text">
            Recommendation notes
          </span>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <label className="block">
          <span className="mb-1 block text-caption font-medium text-text">
            Variance-from-L1 justification
            {awardsAwayFromL1 ? (
              <span className="font-medium text-danger">, required</span>
            ) : (
              <span className="font-normal text-muted">
                , not required for an L1 award
              </span>
            )}
          </span>
          <Textarea
            rows={5}
            value={variance}
            onChange={(e) => setVariance(e.target.value)}
            aria-describedby="variance-counter"
          />
          {/* The 500-char floor was described in prose and enforced only by the
              server, so a buyer could write a paragraph and be rejected on
              submit. It is now a live gate. */}
          <span
            id="variance-counter"
            className={
              'font-numeric text-caption ' +
              (varianceShort ? 'font-medium text-danger' : 'text-muted')
            }
          >
            {variance.trim().length} / {VARIANCE_MIN_CHARS} characters
            {varianceShort
              ? ` — ${VARIANCE_MIN_CHARS - variance.trim().length} more needed`
              : ''}
          </span>
        </label>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/sourcing/${id}/evaluate`)}>
          Back
        </Button>
        <Button variant="primary" onClick={submitAward} disabled={!canSubmit}>
          Submit for approval
        </Button>
      </div>

      {rows.length > 0 && !canSubmit && (
        <p className="mt-2 text-right text-caption text-muted">
          {incomplete
            ? 'Every allocation needs a vendor, line, quantity and unit price.'
            : varianceShort
              ? 'A justification of at least 500 characters is required to award away from L1.'
              : ''}
        </p>
      )}
    </div>
  );
}
