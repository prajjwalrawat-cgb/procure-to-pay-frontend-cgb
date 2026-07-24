'use client';

import { Button, Pill } from '@/components/ui';
import type { GrnCompleteQcInput, GrnQcSampleInput } from '@/lib/shared';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  useCompleteQc,
  useReceipt,
  useRecordSample,
  useStartQc,
} from '@/lib/api/receipts';
import { statusLabel, statusVariant } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

const inputCls =
  'border-line bg-panel focus-visible:ring-accent w-full rounded-sm border px-2 py-1.5 text-[12px] outline-none focus-visible:ring-2';

const REJECTION_REASONS = [
  'VISIBLE_DAMAGE',
  'WRONG_SPEC',
  'QUALITY_FAIL_DIM',
  'QUANTITY_SHORT',
  'DOCUMENTATION_MISSING',
] as const;

export default function QcPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const push = useToastStore((s) => s.push);
  const { data } = useReceipt(id);
  const startQc = useStartQc(id);
  const recordSample = useRecordSample(id);
  const completeQc = useCompleteQc(id);

  const [measured, setMeasured] = useState<Record<string, Record<string, string>>>({});
  const [defects, setDefects] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<
    Record<string, { accepted: string; rejected: string; reason: string }>
  >({});

  if (!data)
    return <div className="text-muted mx-auto max-w-4xl px-4 py-10">Loading…</div>;

  function recordFor(lineId: string, sampleSize: number): void {
    const m = measured[lineId] ?? {};
    const parametersMeasured: Record<string, number> = {};
    for (const [k, v] of Object.entries(m))
      if (v !== '') parametersMeasured[k] = Number(v);
    const defectList = (defects[lineId] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const body: GrnQcSampleInput = {
      grnLineId: lineId,
      sampleType: 'AQL',
      sampleSize,
      parametersMeasured,
      defectsFound: defectList,
    };
    recordSample.mutate(body, {
      onSuccess: (r) => push(`Sample recorded · ${r.result}`, 'success'),
      onError: (e) => push((e as Error).message, 'error'),
    });
  }

  function complete(): void {
    const lines: GrnCompleteQcInput['lines'] = data!.lines.map((l) => {
      const d = decisions[l.id];
      const accepted = d?.accepted ?? l.qtyReceived;
      const rejected = d?.rejected ?? '0';
      return {
        grnLineId: l.id,
        qtyAccepted: accepted,
        qtyRejected: rejected,
        rejectionReason:
          Number(rejected) > 0
            ? ((d?.reason ??
                'VISIBLE_DAMAGE') as GrnCompleteQcInput['lines'][number]['rejectionReason'])
            : null,
      };
    });
    completeQc.mutate(
      { lines },
      {
        onSuccess: () => {
          push('QC completed', 'success');
          router.push(`/goods-receipt/${id}`);
        },
        onError: (e) => push((e as Error).message, 'error'),
      },
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            QC inspection · <span className="font-numeric">{data.number}</span>
          </h1>
          <p className="text-muted text-[13px]">
            {data.vendor.name} · packing {data.gate.packingCondition}
          </p>
        </div>
        {data.qcStatus === 'NOT_STARTED' && (
          <Button
            size="sm"
            variant="accent"
            disabled={startQc.isPending}
            onClick={() =>
              startQc.mutate(undefined as void, {
                onSuccess: () => push('QC started', 'success'),
                onError: (e) => push((e as Error).message, 'error'),
              })
            }
          >
            Start QC
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {data.lines.map((l) => (
          <div key={l.id} className="border-line bg-panel rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-text text-[13px] font-medium">{l.itemDesc}</span>
              <span className="font-numeric text-faint text-[11px]">
                received {l.qtyReceived} {l.uom}
                {l.samplePlan &&
                  ` · sample ${l.samplePlan.sampleSize} (Ac ${l.samplePlan.acceptNumber} / Re ${l.samplePlan.rejectNumber}, AQL ${l.samplePlan.aqlLevel})`}
              </span>
            </div>

            {l.requiresQc && l.samplePlan ? (
              <>
                <div className="mb-3 grid grid-cols-3 gap-3">
                  {Object.entries(l.qcParameters).map(([param, spec]) => (
                    <label key={param} className="block">
                      <span className="text-faint mb-1 block text-[11px]">
                        {param}{' '}
                        {spec.min !== undefined ? `[${spec.min}–${spec.max}]` : ''}
                        {spec.unit ? ` ${spec.unit}` : ''}
                      </span>
                      <input
                        className={inputCls}
                        value={measured[l.id]?.[param] ?? ''}
                        onChange={(e) =>
                          setMeasured((prev) => ({
                            ...prev,
                            [l.id]: { ...prev[l.id], [param]: e.target.value },
                          }))
                        }
                      />
                      <PassHint
                        min={spec.min}
                        max={spec.max}
                        value={measured[l.id]?.[param]}
                      />
                    </label>
                  ))}
                </div>
                <label className="mb-3 block">
                  <span className="text-faint mb-1 block text-[11px]">
                    Defects found (comma-separated)
                  </span>
                  <input
                    className={inputCls}
                    value={defects[l.id] ?? ''}
                    onChange={(e) =>
                      setDefects((prev) => ({ ...prev, [l.id]: e.target.value }))
                    }
                  />
                </label>
                <Button
                  size="sm"
                  variant="default"
                  disabled={recordSample.isPending}
                  onClick={() => recordFor(l.id, l.samplePlan!.sampleSize)}
                >
                  Record sample
                </Button>
                {l.qcSamples.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {l.qcSamples.map((s) => (
                      <Pill key={s.id} variant={statusVariant(s.result)}>
                        {statusLabel(s.result)}
                      </Pill>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-faint text-[12px]">
                No parametric QC required for this item.
              </p>
            )}

            {/* Decision */}
            <div className="border-line mt-3 grid grid-cols-3 gap-3 border-t pt-3">
              <label className="block">
                <span className="text-faint mb-1 block text-[11px]">Qty accepted</span>
                <input
                  className={inputCls}
                  value={decisions[l.id]?.accepted ?? l.qtyReceived}
                  onChange={(e) =>
                    setDecisions((prev) => ({
                      ...prev,
                      [l.id]: { ...decisionFor(prev, l.id), accepted: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-faint mb-1 block text-[11px]">Qty rejected</span>
                <input
                  className={inputCls}
                  value={decisions[l.id]?.rejected ?? '0'}
                  onChange={(e) =>
                    setDecisions((prev) => ({
                      ...prev,
                      [l.id]: { ...decisionFor(prev, l.id), rejected: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="text-faint mb-1 block text-[11px]">
                  Rejection reason
                </span>
                <select
                  className={inputCls}
                  value={decisions[l.id]?.reason ?? 'VISIBLE_DAMAGE'}
                  onChange={(e) =>
                    setDecisions((prev) => ({
                      ...prev,
                      [l.id]: { ...decisionFor(prev, l.id), reason: e.target.value },
                    }))
                  }
                >
                  {REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          variant="accent"
          size="sm"
          disabled={completeQc.isPending}
          onClick={complete}
        >
          Complete QC
        </Button>
      </div>
    </div>
  );
}

function PassHint({
  min,
  max,
  value,
}: {
  min?: number;
  max?: number;
  value?: string;
}): React.JSX.Element | null {
  if (!value || min === undefined || max === undefined) return null;
  const n = Number(value);
  const pass = n >= min && n <= max;
  return (
    <span className={'text-[10px] ' + (pass ? 'text-accent-2' : 'text-danger')}>
      {pass ? 'PASS' : 'FAIL'}
    </span>
  );
}

function decisionFor(
  prev: Record<string, { accepted: string; rejected: string; reason: string }>,
  id: string,
): { accepted: string; rejected: string; reason: string } {
  return prev[id] ?? { accepted: '', rejected: '0', reason: 'VISIBLE_DAMAGE' };
}
