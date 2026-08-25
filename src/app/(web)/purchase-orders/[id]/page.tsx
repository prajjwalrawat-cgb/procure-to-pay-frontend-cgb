'use client';

import {
  ApprovalChain,
  Button,
  NotShipped,
  PageHeader,
  Pill,
  StageStrip,
} from '@/components/ui';
import { ArrowLeft, Check, Download, Paperclip } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { PoDetailResponse, PoFulfilment, PoLineView } from '@/lib/shared';

import { DocumentLedger } from '@/components/document-ledger';

import {
  useAddPoComment,
  useCancelPo,
  useDecidePo,
  useHoldPo,
  useIssuePo,
  usePurchaseOrder,
  useUpdatePo,
  useSubmitPo,
  useUploadPoAttachment,
} from '@/lib/api/purchase-orders';
import { CustomFieldList } from '@/components/custom-fields';
import { usePlants } from '@/lib/api/refs';
import { useCustomFieldValues } from '@/lib/api/settings';
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
    return <div className="p-6 text-[13px] text-muted">Loading purchase order…</div>;
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
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to purchase orders
      </Link>

      {batch.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-sm bg-accent-wash px-3 py-2 text-[12px] text-accent-2">
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

      <PageHeader
        title={data.number}
        numeric
        meta={
          <>
            <Pill variant={statusVariant(data.status)} dot>
              {statusLabel(data.status)}
            </Pill>
            {/* Receipt and billing move independently of the lifecycle status
                and of each other. An order acknowledged months ago, never
                received and fully invoiced reads as "Acknowledged" and nothing
                else unless all three are shown. */}
            <Pill variant={progressVariant(data.fulfilment.receipt)} dot>
              {receiptLabel(data.fulfilment)}
            </Pill>
            <Pill variant={progressVariant(data.fulfilment.billing)} dot>
              {billingLabel(data.fulfilment)}
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
          </>
        }
        description={
          <>
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
          </>
        }
      />

      <div className="mb-5 rounded-lg border border-line bg-panel p-3.5">
        <StageStrip
          stages={data.stages.map((s) => ({ key: s.key, label: s.label }))}
          activeIndex={Math.max(
            0,
            data.stages.findIndex((s) => s.state === 'active'),
          )}
          failed={data.status === 'CANCELLED' || data.status === 'REJECTED'}
          failedLabel={statusLabel(data.status)}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          {/* Line items */}
          <section>
            <h2 className="mb-2 text-[14px] font-semibold text-ink">Line items</h2>
            <div className="overflow-x-auto rounded-lg border border-line bg-panel">
              <table className="w-full text-[12px]">
                <thead className="bg-canvas text-left text-[10px] uppercase tracking-wide text-faint">
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
            <h2 className="mb-2 text-[14px] font-semibold text-ink">Approval route</h2>
            <div className="rounded-lg border border-line bg-panel p-4">
              <ApprovalChain steps={data.liveApprovalChain} />
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
                  className="flex items-center gap-1 text-accent-2"
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
              <h2 className="text-[14px] font-semibold text-ink">Supporting documents</h2>
              <label className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-accent-2">
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
            <div className="rounded-lg border border-line bg-panel p-3 text-[12px]">
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
                        className="truncate text-accent-2"
                      >
                        {d.filename}
                      </a>
                      <Pill variant="gray">{d.docType.replace(/_/g, ' ')}</Pill>
                      {d.addedAfterIssue && <Pill variant="warn">after issue</Pill>}
                      {d.note && <span className="truncate text-faint">{d.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Terms & conditions — the same rows printed on the PDF and shown to the vendor */}
          <section>
            <h2 className="mb-2 text-[14px] font-semibold text-ink">
              Terms & conditions
            </h2>
            <div className="rounded-lg border border-line bg-panel p-3 text-[12px]">
              {data.terms.length === 0 ? (
                <p className="text-muted">
                  None selected — the PDF prints the built-in standard wording.
                </p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {data.terms.map((t, i) => (
                    <li key={t.id}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-text">
                          {i + 1}. {t.title}
                        </span>
                        {!t.isFromLibrary && <Pill variant="violet">special</Pill>}
                      </div>
                      <p className="pl-4 text-muted">{t.contentText}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          {/* Vendor queries */}
          {queries.length > 0 && (
            <section>
              <h2 className="mb-2 text-[14px] font-semibold text-ink">Vendor queries</h2>
              <div className="flex flex-col gap-2">
                {queries.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-warn/30 bg-warn-wash px-3 py-2 text-[12px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-text">{q.authorName}</span>
                      <span className="font-numeric text-[10px] text-faint">
                        {new Date(q.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-muted">{q.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Activity + comments */}
          <section>
            <h2 className="mb-2 text-[14px] font-semibold text-ink">Activity</h2>
            <ul className="mb-3 flex flex-col gap-1.5 border-l border-line pl-4">
              {data.activity.map((a) => (
                <li key={a.id} className="text-[12px] text-muted">
                  <span className="font-medium text-text">
                    {a.action.replace(/_/g, ' ')}
                  </span>{' '}
                  ·{' '}
                  <span className="font-numeric">
                    {new Date(a.at).toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
              {data.activity.length === 0 && (
                <li className="text-[12px] text-faint">No activity yet.</li>
              )}
            </ul>
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded-sm border border-line bg-panel px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="text-[11px] uppercase tracking-wide text-faint">
              Order value
            </div>
            <div className="font-numeric mt-1 text-[22px] font-semibold tracking-display text-ink">
              {inr(data.amounts.total)}
            </div>
            <dl className="mt-3 flex flex-col gap-1 text-[12px]">
              <Row
                label={`Taxable (${data.amounts.taxKind})`}
                value={inr(data.amounts.subtotal)}
              />
              <Row label="Tax" value={inr(data.amounts.taxAmount)} />
              <Row
                label="Received"
                value={`${data.fulfilment.receivedPct.toFixed(0)}%`}
              />
              <Row label="Invoiced" value={`${data.fulfilment.billedPct.toFixed(0)}%`} />
            </dl>
          </div>

          <BillToPanel
            poId={id}
            billTo={data.billTo}
            editable={data.status === 'DRAFT'}
          />

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
              Vendor
            </div>
            <div className="text-[13px] font-medium text-ink">{data.vendor.name}</div>
            <dl className="mt-1 flex flex-col gap-1 text-[12px]">
              <Row label="Code" value={data.vendor.code} />
              <Row label="GSTIN" value={data.vendor.gstin ?? '—'} />
              <Row label="MSME" value={data.vendor.isMsme ? 'Yes' : 'No'} />
            </dl>
          </div>

          {/* Renders nothing unless the tenant defined fields and this order
              captured some. */}
          <CustomFieldPanel poId={id} />

          {data.requisition && (
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
                Source requisition
              </div>
              <Link
                href={`/requisitions/${data.requisition.id}`}
                className="font-numeric text-[13px] font-medium text-accent-2"
              >
                {data.requisition.number} →
              </Link>
            </div>
          )}

          <div className="rounded-lg border border-line bg-panel p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
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
              <p className="mt-2 text-[11px] text-muted">
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
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
                Budget commitment
              </div>
              <dl className="flex flex-col gap-1 text-[12px]">
                <Row label="Committed" value={inr(data.budgetCommitment.amount)} strong />
              </dl>
            </div>
          )}

          {/* The trust column. Same position on every document detail page. */}
          <DocumentLedger entityId={data.id} />
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          {data.canDecide ? (
            <>
              <input
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                placeholder="Add a decision comment…"
                className="flex-1 rounded-sm border border-line bg-panel px-3 py-2 text-[13px] outline-none"
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
                  variant="commit"
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
              <NotShipped reason="PO amendments arrive in Slice 5.5. To change this order today, cancel it and raise a replacement.">
                <Button variant="ghost" size="sm" disabled>
                  Amend
                </Button>
              </NotShipped>
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
                  variant="commit"
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

/**
 * The GST registration this order bills to.
 *
 * Editable only while the PO is a draft: the place of supply is part of what
 * the vendor is sent, so once the order is out it is history, not a setting.
 * Hidden entirely for a tenant with one registration — there is nothing to
 * choose.
 */
/**
 * Receipt and billing are separate axes and are labelled separately.
 *
 * Collapsing them into one word is what left an order reading "Acknowledged"
 * while it was fully invoiced with nothing received — the single most important
 * thing about it, and the one thing the badge did not say.
 */
function receiptLabel(f: PoFulfilment): string {
  if (f.receipt === 'NONE') return 'Not received';
  if (f.receipt === 'COMPLETE') return 'Fully received';
  return `Part received ${f.receivedPct.toFixed(0)}%`;
}

function billingLabel(f: PoFulfilment): string {
  if (f.billing === 'NONE') return 'Not invoiced';
  if (f.billing === 'OVER') return 'Over-invoiced';
  if (f.billing === 'COMPLETE') return 'Fully invoiced';
  return `Part invoiced ${f.billedPct.toFixed(0)}%`;
}

/**
 * Nothing here is "success". A fully invoiced order is not good news on its
 * own — whether it is depends entirely on the other axis. Neutral for progress,
 * warn only for genuinely over-billed.
 */
function progressVariant(p: PoFulfilment['billing']): 'gray' | 'warn' {
  return p === 'OVER' ? 'warn' : 'gray';
}

function BillToPanel({
  poId,
  billTo,
  editable,
}: {
  poId: string;
  billTo: PoDetailResponse['billTo'];
  editable: boolean;
}): React.JSX.Element | null {
  const plants = usePlants().data?.items ?? [];
  const update = useUpdatePo(poId);
  const toast = useToastStore((s) => s.push);
  if (!billTo) return null;

  const canSwitch = editable && plants.length > 1;
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
        Bill to (GST registration)
      </div>
      {canSwitch ? (
        <select
          value={billTo.id}
          disabled={update.isPending}
          onChange={(e) =>
            update.mutate(
              { billToPlantId: e.target.value },
              {
                onSuccess: () => toast('Billing registration updated', 'success'),
                onError: (err) =>
                  toast(err instanceof Error ? err.message : 'Failed', 'error'),
              },
            )
          }
          className="h-9 w-full rounded-sm border border-line bg-panel px-2 text-[13px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.gstin ? ` · ${p.gstin}` : ''}
            </option>
          ))}
        </select>
      ) : (
        <div className="text-[13px] font-medium text-ink">{billTo.name}</div>
      )}
      <dl className="mt-2 flex flex-col gap-1 text-[12px]">
        <Row label="GSTIN" value={billTo.gstin ?? '—'} />
        <Row label="State" value={billTo.stateCode} />
      </dl>
      {canSwitch && (
        <p className="mt-2 text-[11px] text-faint">
          Decides the GSTIN on the PO and CGST+SGST vs IGST. Locked once submitted.
        </p>
      )}
    </div>
  );
}

/** Admin-defined fields captured on this order, if any. */
function CustomFieldPanel({ poId }: { poId: string }): React.JSX.Element | null {
  const { data } = useCustomFieldValues('PURCHASE_ORDER', poId);
  if (!data || Object.keys(data.values).length === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-faint">
        Additional details
      </div>
      <CustomFieldList entity="PURCHASE_ORDER" values={data.values} />
    </div>
  );
}

function PoLineRow({ line: l }: { line: PoLineView }): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, l.fulfilmentPct));
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2">
        <div className="text-text">{l.itemDesc}</div>
        <div className="font-numeric text-[10px] text-faint">
          {l.hsnCode ?? '—'} · {l.uom}
        </div>
      </td>
      <td className="font-numeric px-3 py-2 text-right text-text">{l.qtyOrdered}</td>
      <td className="font-numeric px-3 py-2 text-right text-muted">{l.qtyReceived}</td>
      <td className="font-numeric px-3 py-2 text-right text-muted">{l.qtyInvoiced}</td>
      <td className="font-numeric px-3 py-2 text-right text-text">
        {inr(l.unitPrice, 0)}
      </td>
      <td className="font-numeric px-3 py-2 text-right font-medium text-ink">
        {inr(l.lineTotal)}
      </td>
      <td className="px-3 py-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-canvas">
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

function DocCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="mb-2 text-[10px] uppercase tracking-wide text-faint">{title}</div>
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
      <dd className={'font-numeric ' + (strong ? 'font-semibold text-ink' : 'text-text')}>
        {value}
      </dd>
    </div>
  );
}
