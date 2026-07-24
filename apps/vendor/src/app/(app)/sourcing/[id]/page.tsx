'use client';

import { Button, Input, Pill } from '@procureflow/ui';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { QuoteLineInput, SpecCompliance } from '@procureflow/shared';

import {
  useCreateQuote,
  useSubmitQuote,
  useUpdateQuote,
  useVendorRfq,
} from '@/lib/sourcing';
import { useToastStore } from '@/store/toast-store';

interface LineDraft {
  rfqLineId: string;
  itemDesc: string;
  qtyQuoted: string;
  unitPriceNative: string;
  taxRate: string;
  deliveryLeadDays: string;
  specCompliance: SpecCompliance;
  deviationNotes: string;
}

export default function VendorRfqDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const toast = useToastStore((s) => s.push);
  const { data: rfq, isLoading } = useVendorRfq(id);
  const createQuote = useCreateQuote();
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const submitQuote = useSubmitQuote(quoteId ?? '');
  const updateQuote = useUpdateQuote(quoteId ?? '');
  const [validityDays, setValidityDays] = useState('30');
  const [proof, setProof] = useState<string | null>(null);

  const [lines, setLines] = useState<LineDraft[]>([]);

  useMemo(() => {
    if (rfq && lines.length === 0) {
      setLines(
        rfq.lines.map((l) => ({
          rfqLineId: l.id,
          itemDesc: l.itemDesc,
          qtyQuoted: l.qtyRequired,
          unitPriceNative: '',
          taxRate: l.taxRate,
          deliveryLeadDays: '',
          specCompliance: 'FULL',
          deviationNotes: '',
        })),
      );
    }
  }, [rfq, lines.length]);

  if (isLoading || !rfq)
    return <div className="text-muted p-8 text-center">Loading…</div>;

  const startQuote = (): void => {
    createQuote.mutate(
      { rfqId: id, envelopeType: 'COMBINED' },
      {
        onSuccess: (r) => {
          setQuoteId(r.id);
          toast('Quote draft started', 'success');
        },
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const saveLines = (): void => {
    if (!quoteId) return;
    const payload: QuoteLineInput[] = lines.map((l) => ({
      rfqLineId: l.rfqLineId,
      qtyQuoted: l.qtyQuoted || '0',
      unitPriceNative: l.unitPriceNative || '0',
      discountPct: '0',
      taxRate: l.taxRate || '0',
      deliveryLeadDays: Number(l.deliveryLeadDays) || 0,
      specCompliance: l.specCompliance,
      deviationNotes: l.deviationNotes || null,
    }));
    updateQuote.mutate(
      {
        validityDays: Number(validityDays) || 30,
        paymentTermsOffered: 'NET_45',
        lines: payload,
      },
      {
        onSuccess: () => toast('Quote saved', 'success'),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const submit = (): void => {
    submitQuote.mutate(undefined, {
      onSuccess: (r) => {
        setProof(r.short);
        toast(`Quote submitted · ${r.short}`, 'success');
      },
      onError: (e) => toast(e.message, 'error'),
    });
  };

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-4">
        <span className="text-accent font-mono text-[12px]">{rfq.number}</span>
        <h1 className="tracking-heading text-ink text-[20px] font-semibold">
          {rfq.title}
        </h1>
        <p className="text-muted text-[13px]">
          {rfq.category} · {rfq.rfqType.replace(/_/g, ' ').toLowerCase()} · INCOTERM{' '}
          {rfq.incotermDefault} · {rfq.paymentTermsDefault}
        </p>
      </div>

      {proof && (
        <div className="border-accent bg-accent-wash mb-4 rounded-lg border p-4 text-[13px]">
          Quote submitted. Proof-of-submission hash:{' '}
          <span className="font-mono">{proof}</span>. Retain for your records.
        </div>
      )}

      <div className="border-line bg-panel mb-4 rounded-lg border p-4">
        <h2 className="text-ink mb-3 text-[14px] font-semibold">Your quote</h2>
        {!quoteId ? (
          <Button variant="primary" onClick={startQuote} disabled={createQuote.isPending}>
            Start quote
          </Button>
        ) : (
          <>
            <table className="w-full text-[13px]">
              <thead className="text-muted text-left">
                <tr>
                  <th className="py-1">Item</th>
                  <th className="py-1">Qty</th>
                  <th className="py-1">Unit price</th>
                  <th className="py-1">Lead (d)</th>
                  <th className="py-1">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.rfqLineId} className="border-line border-t">
                    <td className="py-1">{l.itemDesc}</td>
                    <td className="py-1">
                      <Input
                        className="w-20"
                        value={l.qtyQuoted}
                        onChange={(e) => upd(setLines, i, 'qtyQuoted', e.target.value)}
                      />
                    </td>
                    <td className="py-1">
                      <Input
                        className="w-24"
                        value={l.unitPriceNative}
                        onChange={(e) =>
                          upd(setLines, i, 'unitPriceNative', e.target.value)
                        }
                      />
                    </td>
                    <td className="py-1">
                      <Input
                        className="w-16"
                        value={l.deliveryLeadDays}
                        onChange={(e) =>
                          upd(setLines, i, 'deliveryLeadDays', e.target.value)
                        }
                      />
                    </td>
                    <td className="py-1">
                      <select
                        className="border-line bg-panel h-8 rounded border px-1"
                        value={l.specCompliance}
                        onChange={(e) =>
                          upd(
                            setLines,
                            i,
                            'specCompliance',
                            e.target.value as SpecCompliance,
                          )
                        }
                      >
                        <option>FULL</option>
                        <option>PARTIAL</option>
                        <option>DEVIATION</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-muted text-[12px]">Validity (days)</span>
              <Input
                className="w-20"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
              />
              <Button
                variant="accent"
                onClick={saveLines}
                disabled={updateQuote.isPending}
              >
                Save
              </Button>
              <Button variant="primary" onClick={submit} disabled={submitQuote.isPending}>
                Submit sealed quote
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="border-line bg-panel rounded-lg border p-4">
        <h2 className="text-ink mb-2 text-[14px] font-semibold">Public Q&amp;A</h2>
        {rfq.questions.length === 0 && (
          <p className="text-muted text-[13px]">No public answers yet.</p>
        )}
        {rfq.questions.map((q) => (
          <div
            key={q.id}
            className="border-line border-t py-2 text-[13px] first:border-0"
          >
            <p>{q.questionText}</p>
            {q.answerText && <p className="text-accent-2">↳ {q.answerText}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function upd(
  setLines: React.Dispatch<React.SetStateAction<LineDraft[]>>,
  i: number,
  key: keyof LineDraft,
  value: string,
): void {
  setLines((p) => p.map((l, j) => (j === i ? { ...l, [key]: value } : l)));
}
