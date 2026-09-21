'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pill,
  Skeleton,
  cn,
  controlClass,
} from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { QuoteLineInput, SpecCompliance } from '@/lib/shared';

import {
  useCreateQuote,
  useMyQuote,
  useSubmitQuote,
  useUpdateQuote,
  useUploadQuoteFile,
  useVendorRfq,
} from '@/vendor/lib/sourcing';
import { useToastStore } from '@/vendor/store/toast-store';
import { statusLabel } from '@/lib/format';

interface LineDraft {
  rfqLineId: string;
  itemDesc: string;
  /** What the buyer asked for — shown beside the inputs, never edited here. */
  qtyRequired: string;
  uom: string;
  hsnCode: string | null;
  qtyQuoted: string;
  unitPriceNative: string;
  taxRate: string;
  deliveryLeadDays: string;
  specCompliance: SpecCompliance;
  deviationNotes: string;
}

const COMPLIANCE_HINT: Record<SpecCompliance, string> = {
  FULL: 'Meets the specification as written.',
  PARTIAL: 'Meets it in part — say what differs in the notes.',
  DEVIATION: 'Offering an alternative — describe it in the notes.',
};

const DOC_TYPES = [
  { value: 'COMMERCIAL_BID', label: 'Quotation / commercial bid' },
  { value: 'TECH_SPEC', label: 'Technical specification' },
  { value: 'CERTIFICATION', label: 'Certificate' },
  { value: 'REFERENCE', label: 'Reference' },
  { value: 'OTHER', label: 'Other' },
];

function money(n: number): string {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Days until the bid closes — the one number a vendor cares about most. */
function daysLeft(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return { text: 'Bidding has closed', urgent: true };
  const days = Math.ceil(ms / 86_400_000);
  return {
    text: days === 1 ? 'Closes tomorrow' : `Closes in ${days} days`,
    urgent: days <= 2,
  };
}

export default function VendorRfqDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const toast = useToastStore((s) => s.push);
  const { data: rfq, isLoading, error, refetch } = useVendorRfq(id);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const createQuote = useCreateQuote();
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const submitQuote = useSubmitQuote(quoteId ?? '');
  const updateQuote = useUpdateQuote(quoteId ?? '');
  const uploadFile = useUploadQuoteFile(quoteId ?? '');
  const { data: quote } = useMyQuote(quoteId ?? '');
  const [validityDays, setValidityDays] = useState('30');
  const [docType, setDocType] = useState('COMMERCIAL_BID');
  const [proof, setProof] = useState<string | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);

  // Seed the draft from the RFQ once, so re-fetches never overwrite typing.
  useEffect(() => {
    if (!rfq || lines.length > 0) return;
    setLines(
      rfq.lines.map((l) => ({
        rfqLineId: l.id,
        itemDesc: l.itemDesc,
        qtyRequired: l.qtyRequired,
        uom: l.uom,
        hsnCode: l.hsnCode,
        qtyQuoted: l.qtyRequired,
        unitPriceNative: '',
        taxRate: l.taxRate,
        deliveryLeadDays: '',
        specCompliance: 'FULL',
        deviationNotes: '',
      })),
    );
  }, [rfq, lines.length]);

  if (error) {
    return (
      <div>
        <BackLink />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }
  if (isLoading || !rfq) {
    return (
      <div aria-busy="true" aria-live="polite">
        <BackLink />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-7 w-80 max-w-full" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        <Skeleton className="mt-6 h-48 rounded-lg" />
        <Skeleton className="mt-4 h-24 rounded-lg" />
      </div>
    );
  }

  const lineTotal = (l: LineDraft): number => {
    const qty = Number(l.qtyQuoted) || 0;
    const price = Number(l.unitPriceNative) || 0;
    return qty * price;
  };
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const taxTotal = lines.reduce(
    (sum, l) => sum + lineTotal(l) * (Number(l.taxRate) || 0),
    0,
  );
  const priced = lines.every((l) => Number(l.unitPriceNative) > 0);
  const closing = daysLeft(rfq.bidDeadline ?? null);
  const submitted = !!proof || quote?.status === 'SUBMITTED';

  const startQuote = (): void => {
    createQuote.mutate(
      { rfqId: id, envelopeType: 'COMBINED' },
      {
        onSuccess: (r) => {
          setQuoteId(r.id);
          toast('Quote draft started — nothing is visible to the buyer yet', 'success');
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
        onSuccess: () => toast('Draft saved', 'success'),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  // Sealed and final: there is no edit after this, so the confirm dialog makes
  // the vendor say so before this runs.
  const submit = (): void => {
    submitQuote.mutate(undefined, {
      onSuccess: (r) => {
        setConfirmSubmit(false);
        setProof(r.short);
        toast(`Quote submitted, ${r.short}`, 'success');
      },
      onError: (e) => toast(e.message, 'error'),
    });
  };

  const onFile = (file: File | undefined): void => {
    if (!file || !quoteId) return;
    uploadFile.mutate(
      { file, docType, envelope: docType === 'TECH_SPEC' ? 'TECHNICAL' : 'COMMERCIAL' },
      {
        onSuccess: (r) => toast(`${r.filename} attached`, 'success'),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  return (
    <div className={quoteId && !submitted ? 'pb-28' : 'pb-8'}>
      <BackLink />
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-numeric text-caption text-muted">{rfq.number}</span>
        <span className="text-caption text-muted">{statusLabel(rfq.rfqType)}</span>
        {closing && (
          <Pill variant={closing.urgent ? 'danger' : 'neutral'} dot>
            {closing.text}
          </Pill>
        )}
      </div>
      <PageHeader
        title={rfq.title}
        description={
          <>
            {rfq.category} · Incoterm {rfq.incotermDefault} ·{' '}
            {statusLabel(rfq.paymentTermsDefault)} · Quote in {rfq.currency ?? 'INR'}
          </>
        }
      />

      {proof && (
        <div className="mb-4 rounded-lg border border-success/30 bg-success-bg p-4 text-body-sm text-text">
          <strong>Quote submitted.</strong> Proof-of-submission hash:{' '}
          <span className="font-numeric break-all">{proof}</span>. Keep it — it proves what you sent
          and when, before any envelope was opened.
        </div>
      )}

      {!quoteId ? (
        <Section title="Your quote">
          <p className="mb-3 text-body-sm text-muted">
            Start a draft to price each line. Nothing reaches the buyer until you submit,
            and even then it stays sealed until the open ceremony.
          </p>
          <Button variant="primary" onClick={startQuote} disabled={createQuote.isPending}>
            {createQuote.isPending ? 'Starting…' : 'Start quote'}
          </Button>
        </Section>
      ) : (
        <>
          <Section title="Your quote">
            {lines.map((l, i) => (
              <div key={l.rfqLineId} className="mb-3 rounded-md border border-line p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-body-sm font-medium text-ink">{l.itemDesc}</span>
                  <span className="text-caption text-muted">
                    Asked for {l.qtyRequired} {l.uom}
                    {l.hsnCode ? ` · HSN ${l.hsnCode}` : ''} · Tax{' '}
                    {(Number(l.taxRate) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <LabelledInput
                    label={`Qty (${l.uom})`}
                    value={l.qtyQuoted}
                    onChange={(v) => upd(setLines, i, 'qtyQuoted', v)}
                    disabled={submitted}
                  />
                  <LabelledInput
                    label="Unit price ₹"
                    value={l.unitPriceNative}
                    onChange={(v) => upd(setLines, i, 'unitPriceNative', v)}
                    disabled={submitted}
                  />
                  <LabelledInput
                    label="Lead time (days)"
                    value={l.deliveryLeadDays}
                    onChange={(v) => upd(setLines, i, 'deliveryLeadDays', v)}
                    disabled={submitted}
                  />
                  <label className="block">
                    <span className="mb-1 block text-caption text-muted">Compliance</span>
                    <select
                      className={cn(controlClass, 'w-full')}
                      value={l.specCompliance}
                      disabled={submitted}
                      onChange={(e) =>
                        upd(
                          setLines,
                          i,
                          'specCompliance',
                          e.target.value as SpecCompliance,
                        )
                      }
                    >
                      <option value="FULL">Full</option>
                      <option value="PARTIAL">Partial</option>
                      <option value="DEVIATION">Deviation</option>
                    </select>
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                  <label className="block flex-1">
                    <span className="mb-1 block text-caption text-muted">
                      {COMPLIANCE_HINT[l.specCompliance]}
                    </span>
                    <Input
                      value={l.deviationNotes}
                      disabled={submitted || l.specCompliance === 'FULL'}
                      placeholder={
                        l.specCompliance === 'FULL'
                          ? 'No notes needed'
                          : 'Describe what differs from the specification'
                      }
                      onChange={(e) => upd(setLines, i, 'deviationNotes', e.target.value)}
                    />
                  </label>
                  <span className="font-numeric text-body-sm text-ink">
                    {money(lineTotal(l))}
                  </span>
                </div>
              </div>
            ))}

            <div className="mt-3 flex flex-col items-end gap-1 border-t border-line pt-3 text-body-sm">
              <span className="text-muted">Subtotal {money(subtotal)}</span>
              <span className="text-muted">Tax {money(taxTotal)}</span>
              <span className="font-numeric text-h3 font-semibold text-ink">
                Total {money(subtotal + taxTotal)}
              </span>
            </div>
          </Section>

          <Section title="Attachments">
            <p className="mb-3 text-body-sm text-muted">
              Attach your own quotation document, technical specs or certificates. PDF or
              image, up to 10 MB each.
            </p>
            {(quote?.attachments ?? []).length === 0 && (
              <p className="text-caption text-faint">Nothing attached yet.</p>
            )}
            {(quote?.attachments ?? []).map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-x-3 border-t border-line py-2 text-body-sm first:border-0"
              >
                <span className="min-w-0 truncate text-text">{a.filename}</span>
                <span className="shrink-0 text-caption text-muted">
                  {statusLabel(a.docType)} · {fileSize(a.sizeBytes)}
                </span>
              </div>
            ))}
            {!submitted && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className={cn(controlClass, 'w-auto')}
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={uploadFile.isPending}
                  onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="text-caption"
                />
                {uploadFile.isPending && (
                  <span className="text-caption text-muted">Uploading…</span>
                )}
              </div>
            )}
          </Section>
        </>
      )}

      <Section title="Public Q&amp;A">
        {rfq.questions.length === 0 && (
          <EmptyState
            compact
            title="No public answers yet"
            detail="Answers the buyer publishes to any supplier's question appear here for everyone invited."
          />
        )}
        {rfq.questions.map((q) => (
          <div
            key={q.id}
            className="border-t border-line py-2 text-body-sm first:border-0"
          >
            <p className="text-text">{q.questionText}</p>
            {q.answerText && <p className="mt-0.5 text-muted">↳ {q.answerText}</p>}
          </div>
        ))}
      </Section>

      {quoteId && !submitted && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur">
          <div className="pf-container flex flex-wrap items-center gap-3 py-3">
            <label className="flex items-center gap-2 text-caption">
              <span className="text-muted">Validity (days)</span>
              <Input
                className="w-20"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
              />
            </label>
            <span className="ml-auto text-body-sm text-muted">
              Total {money(subtotal + taxTotal)}
            </span>
            <Button variant="secondary" onClick={saveLines} disabled={updateQuote.isPending}>
              {updateQuote.isPending ? 'Saving…' : 'Save draft'}
            </Button>
            <Button
              variant="primary"
              onClick={() => setConfirmSubmit(true)}
              disabled={submitQuote.isPending || !priced}
              title={priced ? undefined : 'Enter a unit price on every line first'}
            >
              {submitQuote.isPending ? 'Submitting…' : 'Submit sealed quote'}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogTitle>Submit your sealed quote?</DialogTitle>
          <DialogDescription>
            The buyer cannot see it until the bids are opened, and you cannot edit it
            afterwards. To change it you would have to withdraw and quote again.
          </DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmSubmit(false)}>
              Keep editing
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={submitQuote.isPending}
              onClick={submit}
            >
              {submitQuote.isPending ? 'Submitting…' : 'Submit sealed quote'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackLink(): React.JSX.Element {
  return (
    <Link
      href="/vendor/sourcing"
      className="mb-3 inline-flex items-center gap-1 text-caption text-muted hover:text-text"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to RFQ invitations
    </Link>
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
    <div className="mb-4 rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-3 text-h3 font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

function LabelledInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-caption text-muted">{label}</span>
      <Input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
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
