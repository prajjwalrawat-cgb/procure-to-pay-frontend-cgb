'use client';

import { Button, Pill } from '@/components/ui';
import { ArrowLeft, Check, Download, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { LiveApprovalStep, PoLineView } from '@/lib/shared';

import {
  useAddPoComment,
  useCancelPo,
  useDecidePo,
  useHoldPo,
  useIssuePo,
  usePurchaseOrder,
  useSubmitPo,
  useUploadPoAttachment,
} from '@/lib/api/purchase-orders';
import { openAuthedAsset } from '@/lib/api-client';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { useToastStore } from '@/store/toast-store';

export default function PurchaseOrderDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const batch = (searchParams.get('batch') ?? '').split(',').filter(Boolean);
  const toast = useToastStore((s) => s.push);

  const { data, isLoading } = usePurchaseOrder(id);
  const decide = useDecidePo(id);
  const issue = useIssuePo(id);
  const cancel = useCancelPo(id);
  const hold = useHoldPo(id);
  const submit = useSubmitPo(id);
  const addComment = useAddPoComment(id);
  const attach = useUploadPoAttachment();

  const [comment, setComment] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [uploading, setUploading] = useState(false);

  const onAttach = (file: File): void => {
    setUploading(true);
    // Defaults to QUOTE: on a spot buy that is nearly always what is being
    // attached, and the type is visible on the row afterwards.
    attach.mutate(
      { poId: id, file, docType: 'QUOTE' },
      {
        onSuccess: () => toast(`${file.name} attached`, 'success'),
        onError: (e) => toast(e instanceof Error ? e.message : 'Upload failed', 'error'),
        onSettled: () => setUploading(false),
      },
    );
  };

  if (isLoading || !data) {
    return <div className="text-muted p-6 text-[13px]">Loading purchase order…</div>;
  }

  const queries = data.comments.filter((c) => c.source === 'VENDOR' || c.isQuery);

  const onDecide = (decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'): void => {
    if (!data.myApprovalId) return;
    decide.mutate(
      { approvalId: data.myApprovalId, decision, comment: decisionComment || null },
      {
        onSuccess: () => {
          toast(
            decision === 'APPROVE'
              ? 'Approved'
              : decision === 'REJECT'
                ? 'Rejected'
                : 'Changes requested',
            decision === 'REJECT' ? 'error' : 'success',
          );
          setDecisionComment('');
        },
        onError: (e) => toast((e as Error).message, 'error'),
      },
    );
  };

  const onIssue = (): void =>
    issue.mutate(undefined, {
      onSuccess: () => toast('PO issued to vendor', 'success'),
      onError: (e) => toast((e as Error).message, 'error'),
    });

  const onSubmit = (): void =>
    submit.mutate(undefined, {
      onSuccess: () => toast('Submitted for approval', 'success'),
      onError: (e) => toast((e as Error).message, 'error'),
    });

  const onCancel = (): void => {
    const reason = window.prompt('Reason for cancellation?');
    if (!reason) return;
    cancel.mutate(reason, {
      onSuccess: () => toast('PO cancelled', 'success'),
      onError: (e) => toast((e as Error).message, 'error'),
    });
  };

  const onHold = (): void => {
    const reason = window.prompt('Reason to put on hold?');
    if (!reason) return;
    hold.mutate(reason, {
      onSuccess: () => toast('PO placed on hold', 'success'),
      onError: (e) => toast((e as Error).message, 'error'),
    });
  };

  // The access token lives in memory only, so a plain window.open() at the API
  // URL arrives without an Authorization header and 401s. Fetch the PDF
  // authenticated and hand the browser a blob instead.
  const openPdf = (): void => {
    openAuthedAsset(`/purchase-orders/${id}/pdf`).catch((e) =>
      toast(e instanceof Error ? e.message : 'Could not open the PDF', 'error'),
    );
  };

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <Link
        href="/purchase-orders"
        className="text-muted mb-3 inline-flex items-center gap-1 text-[12px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to purchase orders
      </Link>

      {batch.length > 0 && (
        <div className="bg-accent-wash text-accent-2 mb-4 flex items-center gap-2 rounded-sm px-3 py-2 text-[12px]">
          <Check className="h-3.5 w-3.5" />
          Batch created ({batch.length} more):
          {batch.map((bid, i) => (
            <Link
              key={bid}
              href={`/purchase-orders/${bid}`}
              className="font-numeric underline"
            >
              PO {i + 2}
            </Link>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="tracking-heading text-ink flex items-center gap-2 text-[20px] font-semibold">
            <span className="font-numeric">{data.number}</span>
            <Pill variant={statusVariant(data.status)} dot>
              {statusLabel(data.status)}
            </Pill>
            <Pill variant="outline">{data.poType}</Pill>
            {data.acknowledgedAt ? (
              <Pill variant="success" dot>
                Acknowledged
              </Pill>
            ) : (
              <Pill variant="gray" dot>
                Awaiting ack
              </Pill>
            )}
          </h1>
          <p className="text-muted mt-0.5 text-[13px]">
            {data.vendor.name}
            {data.vendor.isMsme && (
              <Pill variant="violet" className="ml-1.5">
                MSME
              </Pill>
            )}{' '}
            · Issued{' '}
            {data.issuedAt ? new Date(data.issuedAt).toLocaleDateString('en-IN') : '—'} ·
            Expected{' '}
            {data.expectedDeliveryDate
              ? new Date(data.expectedDeliveryDate).toLocaleDateString('en-IN')
              : '—'}
          </p>
        </div>
      </div>

      {/* Stage strip */}
      <div className="mb-5 flex items-center gap-1 overflow-x-auto">
        {data.stages.map((s) => (
          <span
            key={s.key}
            className={
              'rounded-xs whitespace-nowrap px-2.5 py-1 text-[12px] font-medium ' +
              (s.state === 'done'
                ? 'bg-accent-wash text-accent-2'
                : s.state === 'active'
                  ? 'bg-ink text-white'
                  : 'bg-canvas text-faint')
            }
          >
            {s.label}
          </span>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          {/* Line items */}
          <section>
            <h2 className="text-ink mb-2 text-[14px] font-semibold">Line items</h2>
            <div className="border-line bg-panel overflow-hidden rounded-lg border">
              <table className="w-full text-[12px]">
                <thead className="bg-canvas text-faint text-left text-[10px] uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">Ordered</th>
                    <th className="px-3 py-2 text-right font-medium">Received</th>
                    <th className="px-3 py-2 text-right font-medium">Invoiced</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">Line total</th>
                    <th className="px-3 py-2 font-medium">Fulfilment</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l) => (
                    <PoLineRow key={l.id} line={l} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Approval chain */}
          <section>
            <h2 className="text-ink mb-2 text-[14px] font-semibold">Approval chain</h2>
            <div className="flex flex-wrap items-center gap-2">
              {data.liveApprovalChain.map((s) => (
                <ApprovalStepPill
                  key={`${s.stepNo}-${s.approvalId ?? s.stepNo}`}
                  step={s}
                />
              ))}
              {data.liveApprovalChain.length === 0 && (
                <span className="text-muted text-[12px]">
                  No approval steps for this order.
                </span>
              )}
            </div>
          </section>

          {/* Documents */}
          <section className="grid gap-3 md:grid-cols-3">
            <DocCard title="Goods receipts">
              {data.grnLinks.length === 0 ? (
                <span className="text-faint">No GRNs yet</span>
              ) : (
                data.grnLinks.map((g) => (
                  <div key={g.id} className="flex items-center justify-between">
                    <span className="font-numeric text-accent-2">{g.number}</span>
                    <Pill variant={statusVariant(g.qcStatus)}>{g.qcStatus}</Pill>
                  </div>
                ))
              )}
            </DocCard>
            <DocCard title="Invoices">
              {data.invoiceLinks.length === 0 ? (
                <span className="text-faint">No invoices yet</span>
              ) : (
                data.invoiceLinks.map((iv) => (
                  <Link
                    key={iv.id}
                    href={`/invoices/${iv.id}`}
                    className="flex items-center justify-between"
                  >
                    <span className="font-numeric text-accent-2">{iv.number}</span>
                    <Pill variant={statusVariant(iv.status)}>
                      {statusLabel(iv.status)}
                    </Pill>
                  </Link>
                ))
              )}
            </DocCard>
            <DocCard title="Attachments">
              {data.pdfAvailable ? (
                <button
                  type="button"
                  onClick={openPdf}
                  className="text-accent-2 flex items-center gap-1"
                >
                  <Download className="h-3.5 w-3.5" /> PO PDF
                </button>
              ) : (
                <span className="text-faint">PDF not generated</span>
              )}
              {data.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-2"
                >
                  Attachment
                </a>
              ))}
            </DocCard>
          </section>

          {/* Supporting documents — buyer-side only; never shown in the vendor portal */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-ink text-[14px] font-semibold">Supporting documents</h2>
              <label className="text-accent-2 flex cursor-pointer items-center gap-1 text-[12px] font-medium">
                <Paperclip className="h-3.5 w-3.5" />
                {uploading ? 'Uploading…' : 'Attach'}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onAttach(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="border-line bg-panel rounded-lg border p-3 text-[12px]">
              {data.supportingDocuments.length === 0 ? (
                <p className="text-muted">
                  {data.poType === 'SPOT_BUY'
                    ? 'No quote attached — this order was raised without a requisition, so nothing here evidences the price.'
                    : 'None.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {data.supportingDocuments.map((d) => (
                    <li key={d.id} className="flex items-center gap-2">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-2 truncate"
                      >
                        {d.filename}
                      </a>
                      <Pill variant="gray">{d.docType.replace(/_/g, ' ')}</Pill>
                      {d.addedAfterIssue && <Pill variant="warn">after issue</Pill>}
                      {d.note && <span className="text-faint truncate">{d.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Terms & conditions — the same rows printed on the PDF and shown to the vendor */}
          <section>
            <h2 className="text-ink mb-2 text-[14px] font-semibold">Terms & conditions</h2>
            <div className="border-line bg-panel rounded-lg border p-3 text-[12px]">
              {data.terms.length === 0 ? (
                <p className="text-muted">
                  None selected — the PDF prints the built-in standard wording.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {data.terms.map((t, i) => (
                    <li key={t.id}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-text font-medium">
                          {i + 1}. {t.title}
                        </span>
                        {!t.isFromLibrary && <Pill variant="violet">special</Pill>}
                      </div>
                      <p className="text-muted pl-4">{t.contentText}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          {/* Vendor queries */}
          {queries.length > 0 && (
            <section>
              <h2 className="text-ink mb-2 text-[14px] font-semibold">Vendor queries</h2>
              <div className="flex flex-col gap-2">
                {queries.map((q) => (
                  <div
                    key={q.id}
                    className="border-warn/30 bg-warn-wash rounded-lg border px-3 py-2 text-[12px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-text font-medium">{q.authorName}</span>
                      <span className="font-numeric text-faint text-[10px]">
                        {new Date(q.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-muted mt-0.5">{q.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Activity + comments */}
          <section>
            <h2 className="text-ink mb-2 text-[14px] font-semibold">Activity</h2>
            <ul className="border-line mb-3 flex flex-col gap-1.5 border-l pl-4">
              {data.activity.map((a) => (
                <li key={a.id} className="text-muted text-[12px]">
                  <span className="text-text font-medium">
                    {a.action.replace(/_/g, ' ')}
                  </span>{' '}
                  ·{' '}
                  <span className="font-numeric">
                    {new Date(a.at).toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
              {data.activity.length === 0 && (
                <li className="text-faint text-[12px]">No activity yet.</li>
              )}
            </ul>
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment…"
                className="border-line bg-panel focus-visible:ring-accent flex-1 rounded-sm border px-3 py-2 text-[13px] outline-none focus-visible:ring-2"
              />
              <Button
                size="sm"
                variant="default"
                disabled={!comment.trim() || addComment.isPending}
                onClick={() =>
                  addComment.mutate(comment, {
                    onSuccess: () => {
                      setComment('');
                      toast('Comment added', 'success');
                    },
                  })
                }
              >
                Comment
              </Button>
            </div>
          </section>
        </div>

        {/* Right panel */}
        <aside className="flex flex-col gap-4">
          <div className="border-line bg-panel rounded-lg border p-4">
            <div className="text-faint text-[11px] uppercase tracking-wide">
              Order value
            </div>
            <div className="font-numeric tracking-display text-ink mt-1 text-[22px] font-semibold">
              {inr(data.amounts.total)}
            </div>
            <dl className="mt-3 flex flex-col gap-1 text-[12px]">
              <Row
                label={`Taxable (${data.amounts.taxKind})`}
                value={inr(data.amounts.subtotal)}
              />
              <Row label="Tax" value={inr(data.amounts.taxAmount)} />
              <Row label="Fulfilment" value={`${data.fulfilmentPct.toFixed(0)}%`} />
            </dl>
          </div>

          <div className="border-line bg-panel rounded-lg border p-4">
            <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">
              Vendor
            </div>
            <div className="text-ink text-[13px] font-medium">{data.vendor.name}</div>
            <dl className="mt-1 flex flex-col gap-1 text-[12px]">
              <Row label="Code" value={data.vendor.code} />
              <Row label="GSTIN" value={data.vendor.gstin ?? '—'} />
              <Row label="MSME" value={data.vendor.isMsme ? 'Yes' : 'No'} />
            </dl>
          </div>

          {data.requisition && (
            <div className="border-line bg-panel rounded-lg border p-4">
              <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">
                Source requisition
              </div>
              <Link
                href={`/requisitions/${data.requisition.id}`}
                className="font-numeric text-accent-2 text-[13px] font-medium"
              >
                {data.requisition.number} →
              </Link>
            </div>
          )}

          <div className="border-line bg-panel rounded-lg border p-4">
            <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">
              Terms & delivery
            </div>
            <dl className="flex flex-col gap-1 text-[12px]">
              <Row label="Incoterm" value={data.deliveryTerms ?? '—'} />
              <Row
                label="Payment"
                value={
                  data.paymentTerms
                    ? (data.paymentTerms.label ?? data.paymentTerms.kind)
                    : '—'
                }
              />
              <Row
                label="Expected"
                value={
                  data.expectedDeliveryDate
                    ? new Date(data.expectedDeliveryDate).toLocaleDateString('en-IN')
                    : '—'
                }
              />
            </dl>
            {data.deliveryAddress && (
              <p className="text-muted mt-2 text-[11px]">
                {[
                  data.deliveryAddress.line1,
                  data.deliveryAddress.line2,
                  data.deliveryAddress.city,
                  data.deliveryAddress.pincode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>

          {data.budgetCommitment && (
            <div className="border-line bg-panel rounded-lg border p-4">
              <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">
                Budget commitment
              </div>
              <dl className="flex flex-col gap-1 text-[12px]">
                <Row label="Committed" value={inr(data.budgetCommitment.amount)} strong />
              </dl>
            </div>
          )}
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="border-line bg-panel/95 fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
          {data.canDecide ? (
            <>
              <input
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                placeholder="Add a decision comment…"
                className="border-line bg-panel flex-1 rounded-sm border px-3 py-2 text-[13px] outline-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() => onDecide('REJECT')}
                >
                  Reject
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() => onDecide('REQUEST_CHANGES')}
                >
                  Request changes
                </Button>
                <Button
                  variant="accent"
                  disabled={decide.isPending}
                  onClick={() => onDecide('APPROVE')}
                >
                  Approve
                </Button>
              </div>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={openPdf}
                disabled={!data.pdfAvailable}
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
              <span title="Coming in Slice 5.5">
                <Button variant="ghost" size="sm" disabled>
                  Amend
                </Button>
              </span>
              {data.canHold && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={hold.isPending}
                  onClick={onHold}
                >
                  Put on hold
                </Button>
              )}
              {data.canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={cancel.isPending}
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              )}
              {data.status === 'DRAFT' && (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={submit.isPending}
                  onClick={onSubmit}
                >
                  Submit for approval
                </Button>
              )}
              {data.canIssue && (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={issue.isPending}
                  onClick={onIssue}
                >
                  Issue
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PoLineRow({ line: l }: { line: PoLineView }): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, l.fulfilmentPct));
  return (
    <tr className="border-line border-t">
      <td className="px-3 py-2">
        <div className="text-text">{l.itemDesc}</div>
        <div className="font-numeric text-faint text-[10px]">
          {l.hsnCode ?? '—'} · {l.uom}
        </div>
      </td>
      <td className="font-numeric text-text px-3 py-2 text-right">{l.qtyOrdered}</td>
      <td className="font-numeric text-muted px-3 py-2 text-right">{l.qtyReceived}</td>
      <td className="font-numeric text-muted px-3 py-2 text-right">{l.qtyInvoiced}</td>
      <td className="font-numeric text-text px-3 py-2 text-right">
        {inr(l.unitPrice, 0)}
      </td>
      <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
        {inr(l.lineTotal)}
      </td>
      <td className="px-3 py-2">
        <div className="bg-canvas h-1.5 w-20 overflow-hidden rounded-full">
          <div
            className={
              'h-full rounded-full ' +
              (pct >= 100 ? 'bg-accent' : pct > 0 ? 'bg-info' : 'bg-faint')
            }
            style={{ width: `${pct}%` }}
          />
        </div>
      </td>
    </tr>
  );
}

function ApprovalStepPill({ step: s }: { step: LiveApprovalStep }): React.JSX.Element {
  return (
    <span
      className={
        'flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-[12px] ' +
        (s.isCurrent
          ? 'border-accent bg-accent-wash'
          : s.decision === 'REJECTED'
            ? 'border-danger/40 bg-danger-wash'
            : 'border-line bg-panel')
      }
    >
      <span className="bg-canvas font-numeric flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
        {s.stepNo}
      </span>
      <span className="text-text font-medium">
        {s.approverName ?? s.role.replace(/_/g, ' ')}
      </span>
      <Pill
        variant={
          s.decision === 'APPROVED'
            ? 'success'
            : s.decision === 'REJECTED'
              ? 'danger'
              : s.slaStatus === 'breach'
                ? 'danger'
                : s.slaStatus === 'warn'
                  ? 'warn'
                  : 'gray'
        }
        dot
      >
        {s.decision === 'PENDING'
          ? s.isCurrent
            ? 'Current'
            : 'Pending'
          : s.decision.replace(/_/g, ' ')}
      </Pill>
    </span>
  );
}

function DocCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-line bg-panel rounded-lg border p-3">
      <div className="text-faint mb-2 text-[10px] uppercase tracking-wide">{title}</div>
      <div className="flex flex-col gap-1.5 text-[12px]">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={'font-numeric ' + (strong ? 'text-ink font-semibold' : 'text-text')}>
        {value}
      </dd>
    </div>
  );
}
