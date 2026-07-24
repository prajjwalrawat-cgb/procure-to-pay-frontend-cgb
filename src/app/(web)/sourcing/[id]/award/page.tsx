'use client';

import { Button, Input } from '@/components/ui';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AwardAllocationInput } from '@/lib/shared';

import { useComparison, useRecommendAward, useSubmitAward } from '@/lib/api/sourcing';
import { inr } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

interface AllocRow {
  quoteId: string;
  rfqLineId: string;
  vendor: string;
  qtyAllocated: string;
  unitPrice: string;
}

/** Award recommendation: line-by-line allocation, L1-variance justification. */
export default function AwardPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data: matrix } = useComparison(id);
  const recommend = useRecommendAward(id);
  const submit = useSubmitAward(id);

  const [rows, setRows] = useState<AllocRow[]>([]);
  const [variance, setVariance] = useState('');
  const [notes, setNotes] = useState('');

  const line = matrix?.lines[0];

  const addRow = (): void => {
    if (!matrix || !line) return;
    const q = matrix.rows[0];
    setRows((p) => [
      ...p,
      {
        quoteId: q?.quoteId ?? '',
        rfqLineId: line.id,
        vendor: q?.displayName ?? '',
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

  return (
    <div className="mx-auto max-w-[900px]">
      <h1 className="tracking-heading text-ink mb-4 text-[20px] font-semibold">
        Award recommendation
      </h1>

      <div className="border-line bg-panel mb-4 rounded-lg border p-4">
        <h2 className="text-ink mb-2 text-[14px] font-semibold">Quotes</h2>
        <table className="w-full text-[13px]">
          <thead className="text-muted text-left">
            <tr>
              <th className="py-1">Vendor</th>
              <th className="py-1">Rank</th>
              <th className="py-1 text-right">Landed (INR)</th>
              <th className="py-1 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {matrix?.rows.map((r) => (
              <tr key={r.quoteId} className="border-line border-t">
                <td className="py-1 font-mono text-[11px]">{r.quoteId.slice(-8)}</td>
                <td className="py-1">
                  {r.displayName} {r.rankLabel}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {r.totalLandedInr ? inr(r.totalLandedInr) : '—'}
                </td>
                <td className="py-1 text-right tabular-nums">{r.weightedTotal ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-line bg-panel mb-4 rounded-lg border p-4">
        <h2 className="text-ink mb-2 text-[14px] font-semibold">Allocation</h2>
        {rows.map((r, i) => (
          <div key={i} className="mb-2 grid grid-cols-4 gap-2">
            <Input
              placeholder="quoteId"
              value={r.quoteId}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x, j) => (j === i ? { ...x, quoteId: e.target.value } : x)),
                )
              }
            />
            <Input
              placeholder="rfqLineId"
              value={r.rfqLineId}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x, j) => (j === i ? { ...x, rfqLineId: e.target.value } : x)),
                )
              }
            />
            <Input
              placeholder="Qty"
              value={r.qtyAllocated}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x, j) => (j === i ? { ...x, qtyAllocated: e.target.value } : x)),
                )
              }
            />
            <Input
              placeholder="Unit price"
              value={r.unitPrice}
              onChange={(e) =>
                setRows((p) =>
                  p.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)),
                )
              }
            />
          </div>
        ))}
        <Button variant="ghost" onClick={addRow}>
          + Add allocation
        </Button>
      </div>

      <div className="border-line bg-panel mb-4 rounded-lg border p-4">
        <label className="mb-2 block">
          <span className="text-muted mb-1 block text-[12px]">Recommendation notes</span>
          <textarea
            className="border-line bg-panel w-full rounded-md border p-2 text-[13px]"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-muted mb-1 block text-[12px]">
            Variance-from-L1 justification (required if not awarding to lowest — min 500
            chars for enterprise audit)
          </span>
          <textarea
            className="border-line bg-panel w-full rounded-md border p-2 text-[13px]"
            rows={5}
            value={variance}
            onChange={(e) => setVariance(e.target.value)}
          />
          <span className="text-faint text-[11px]">{variance.length} chars</span>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/sourcing/${id}/evaluate`)}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={submitAward}
          disabled={rows.length === 0 || recommend.isPending || submit.isPending}
        >
          Submit for approval
        </Button>
      </div>
    </div>
  );
}
