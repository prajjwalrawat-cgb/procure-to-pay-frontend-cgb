'use client';

import { Button, Pill } from '@/components/ui';
import { AlertTriangle, ArrowLeft, FileText, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type {
  BudgetCheckResult,
  LiveApprovalStep,
  RequisitionAttachmentType,
  RequisitionAttachmentView,
} from '@/lib/shared';
import { REQUISITION_ATTACHMENT_TYPE } from '@/lib/shared';

import {
  useAddRequisitionComment,
  useCancelRequisition,
  useDecideRequisition,
  useDeleteRequisitionAttachment,
  useRequisition,
  useSubmitRequisition,
  useUploadRequisitionAttachment,
  useWithdrawRequisition,
} from '@/lib/api/requisitions';
import { inr, statusLabel, statusVariant } from '@/lib/format';
import { priorityVariant } from '@/lib/refs';
import { useToastStore } from '@/store/toast-store';

export default function RequisitionDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data, isLoading } = useRequisition(id);

  const submit = useSubmitRequisition(id);
  const withdraw = useWithdrawRequisition(id);
  const cancel = useCancelRequisition(id);
  const decide = useDecideRequisition(id);
  const addComment = useAddRequisitionComment(id);

  const [comment, setComment] = useState('');
  const [decisionComment, setDecisionComment] = useState('');

  if (isLoading || !data) {
    return <div className="text-muted p-6 text-[13px]">Loading requisition…</div>;
  }

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

  const onSubmit = (): void =>
    submit.mutate(undefined, {
      onSuccess: () => toast('Submitted for approval', 'success'),
      onError: (e) => toast((e as Error).message, 'error'),
    });

  const onWithdraw = (): void => {
    const reason = window.prompt('Reason for withdrawal?');
    if (!reason) return;
    withdraw.mutate(reason, {
      onSuccess: () => toast('Requisition withdrawn', 'success'),
      onError: (e) => toast((e as Error).message, 'error'),
    });
  };

  const onCancel = (): void => {
    const reason = window.prompt('Reason for cancellation?');
    if (!reason) return;
    cancel.mutate(reason, {
      onSuccess: () => toast('Requisition cancelled', 'success'),
      onError: (e) => toast((e as Error).message, 'error'),
    });
  };

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <Link
        href="/requisitions"
        className="text-muted mb-3 inline-flex items-center gap-1 text-[12px]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to requisitions
      </Link>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="tracking-heading text-ink flex items-center gap-2 text-[20px] font-semibold">
            <span className="font-numeric">{data.number}</span>
            <Pill variant={statusVariant(data.status)} dot>
              {statusLabel(data.status)}
            </Pill>
            <Pill variant={priorityVariant(data.priority)}>{data.priority}</Pill>
          </h1>
          <p className="text-text mt-0.5 text-[15px] font-medium">{data.title}</p>
          <p className="text-muted text-[12px]">
            {data.requester.name}
            {data.requester.deptName ? ` · ${data.requester.deptName}` : ''} · Needed{' '}
            {data.neededBy ? new Date(data.neededBy).toLocaleDateString('en-IN') : '—'} ·{' '}
            {data.agingDays}d old
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
                    <th className="px-3 py-2 font-medium">HSN</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">On PO</th>
                    <th className="px-3 py-2 text-right font-medium">Received</th>
                    <th className="px-3 py-2 text-right font-medium">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l) => (
                    <tr key={l.id} className="border-line border-t">
                      <td className="px-3 py-2">
                        <div className="text-text">{l.itemDesc}</div>
                        <div className="font-numeric text-faint text-[10px]">
                          {l.skuCode ?? 'Non-catalogued'}
                          {l.preferredVendor ? ` · ${l.preferredVendor.name}` : ''}
                        </div>
                      </td>
                      <td className="font-numeric text-muted px-3 py-2">
                        {l.hsnCode ?? '—'}
                      </td>
                      <td className="font-numeric text-text px-3 py-2 text-right">
                        {l.qty} {l.uom}
                      </td>
                      <td className="font-numeric text-muted px-3 py-2 text-right">
                        {l.qtyIssued}
                      </td>
                      <td className="font-numeric text-muted px-3 py-2 text-right">
                        {l.qtyReceived}
                      </td>
                      <td className="font-numeric text-ink px-3 py-2 text-right font-medium">
                        {inr(l.lineTotal)}
                      </td>
                    </tr>
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
                  No approval steps resolved yet.
                </span>
              )}
            </div>
          </section>

          {/* PO conversions */}
          <section>
            <h2 className="text-ink mb-2 text-[14px] font-semibold">
              PO conversion history
            </h2>
            {data.poConversions.length === 0 ? (
              <div className="text-muted text-[12px]">
                No purchase orders raised from this requisition yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {data.poConversions.map((po) => (
                  <Link
                    key={po.id}
                    href={`/purchase-orders/${po.id}`}
                    className="border-line bg-panel hover:border-accent/50 flex items-center justify-between rounded-lg border px-3 py-2 text-[12px]"
                  >
                    <span>
                      <span className="font-numeric text-ink font-medium">
                        {po.number}
                      </span>{' '}
                      <span className="text-muted">· {po.vendorName}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Pill variant={statusVariant(po.status)} dot>
                        {statusLabel(po.status)}
                      </Pill>
                      <span className="font-numeric text-ink font-medium">
                        {inr(po.totalAmount)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Attachments */}
          <AttachmentsSection
            id={id}
            attachments={data.attachments}
            status={data.status}
            canAttach={data.canAttach}
          />

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

            {data.comments.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {data.comments.map((c) => (
                  <div
                    key={c.id}
                    className="border-line bg-panel rounded-lg border px-3 py-2 text-[12px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-text font-medium">{c.authorName}</span>
                      <span className="font-numeric text-faint text-[10px]">
                        {new Date(c.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-muted mt-0.5">{c.body}</p>
                  </div>
                ))}
              </div>
            )}

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
            <div className="text-faint text-[11px] uppercase tracking-wide">Total</div>
            <div className="font-numeric tracking-display text-ink mt-1 text-[22px] font-semibold">
              {inr(data.amounts.total)}
            </div>
            <dl className="mt-3 flex flex-col gap-1 text-[12px]">
              <Row
                label={`Taxable (${data.amounts.taxKind})`}
                value={inr(data.amounts.subtotal)}
              />
              <Row label="Tax" value={inr(data.amounts.taxAmount)} />
              {data.committedAmount && (
                <Row label="Committed" value={inr(data.committedAmount)} />
              )}
            </dl>
          </div>

          {data.budget && <BudgetBlock budget={data.budget} />}

          <div className="border-line bg-panel rounded-lg border p-4">
            <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">
              Requester
            </div>
            <div className="text-ink text-[13px] font-medium">{data.requester.name}</div>
            <dl className="mt-1 flex flex-col gap-1 text-[12px]">
              <Row label="Department" value={data.requester.deptName ?? '—'} />
              <Row
                label="Cost centre"
                value={`${data.costCenter.code} · ${data.costCenter.name}`}
              />
              <Row label="Plant" value={data.plant.name} />
              <Row label="Delivery" value={data.deliveryLocation ?? '—'} />
            </dl>
          </div>

          <div className="border-line bg-panel rounded-lg border p-4">
            <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">
              Scheduling
            </div>
            <dl className="flex flex-col gap-1 text-[12px]">
              <Row label="Priority" value={data.priority} />
              <Row
                label="Needed by"
                value={
                  data.neededBy
                    ? new Date(data.neededBy).toLocaleDateString('en-IN')
                    : '—'
                }
              />
              <Row label="Aging" value={`${data.agingDays}d`} />
            </dl>
          </div>
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
              {/* A draft with no permitted actions would otherwise render an
                  empty bar, leaving the user with no idea why. */}
              {data.status === 'DRAFT' && !data.canSubmit && !data.canEdit && (
                <span className="text-faint text-[12px]">
                  You can view this draft but not submit it — ask a Procurement Head or
                  an admin.
                </span>
              )}
              {data.canWithdraw && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={withdraw.isPending}
                  onClick={onWithdraw}
                >
                  Withdraw
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
              {data.canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/requisitions/${id}/edit`)}
                >
                  Edit
                </Button>
              )}
              {data.canSubmit && (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={submit.isPending}
                  onClick={onSubmit}
                >
                  Submit for approval
                </Button>
              )}
              {data.canCreatePo && (
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => router.push(`/requisitions/${id}/create-po`)}
                >
                  Create PO
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const DOC_TYPE_LABEL: Record<RequisitionAttachmentType, string> = {
  QUOTE: 'Quotation',
  PROFORMA_INVOICE: 'Proforma invoice (PI)',
  SPECIFICATION: 'Specification',
  DRAWING: 'Drawing',
  OTHER: 'Other',
};

const ACCEPT = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** Once approved, documents may be added by an approver but never removed. */
const DELETE_LOCKED_STATES = [
  'APPROVED',
  'PARTIALLY_ISSUED',
  'FULLY_ISSUED',
  'CANCELLED',
  'CLOSED',
];
const POST_APPROVAL_STATES = ['APPROVED', 'PARTIALLY_ISSUED', 'FULLY_ISSUED'];

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Supporting documents on an existing PR. Uploading here is the path for a
 * vendor PI that arrives after the requisition was already raised — which is
 * the common case when the PI comes over WhatsApp.
 */
function AttachmentsSection(props: {
  id: string;
  attachments: RequisitionAttachmentView[];
  status: string;
  canAttach: boolean;
}): React.JSX.Element {
  const toast = useToastStore((s) => s.push);
  const upload = useUploadRequisitionAttachment(props.id);
  const remove = useDeleteRequisitionAttachment(props.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<RequisitionAttachmentType>('PROFORMA_INVOICE');

  const canDelete = !DELETE_LOCKED_STATES.includes(props.status);
  const postApproval = POST_APPROVAL_STATES.includes(props.status);

  const onPick = (files: FileList | null): void => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast(`${file.name} is larger than 15 MB.`, 'error');
        continue;
      }
      if (!ACCEPT.includes(file.type)) {
        toast(`${file.name} must be a PDF, JPG, PNG or TIFF.`, 'error');
        continue;
      }
      upload.mutate(
        { file, docType },
        {
          onSuccess: () => toast(`${file.name} attached`, 'success'),
          onError: (e) => toast((e as Error).message, 'error'),
        },
      );
    }
  };

  return (
    <section>
      <h2 className="text-ink mb-2 text-[14px] font-semibold">Attachments</h2>

      {props.attachments.length === 0 ? (
        <div className="text-muted mb-3 text-[12px]">
          No quotations, proforma invoices or specs attached yet.
        </div>
      ) : (
        <div className="border-line divide-line mb-3 divide-y rounded-lg border">
          {props.attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="text-faint h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-2 block truncate text-[13px] underline underline-offset-2"
                  >
                    {a.filename}
                  </a>
                ) : (
                  <span className="text-text block truncate text-[13px]">
                    {a.filename}
                  </span>
                )}
                <div className="text-muted text-[11px]">
                  {DOC_TYPE_LABEL[a.docType] ?? a.docType} ·{' '}
                  <span className="font-numeric">{fileSize(a.sizeBytes)}</span> ·{' '}
                  {a.uploadedByName ?? 'Unknown'} ·{' '}
                  <span className="font-numeric">
                    {new Date(a.uploadedAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
                {a.addedAfterApproval && (
                  <div className="text-warn mt-0.5 flex items-center gap-1 text-[11px] font-medium">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Added after approval — the approver did not see this document
                  </div>
                )}
              </div>
              {canDelete && (
                <button
                  type="button"
                  aria-label={`Remove ${a.filename}`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(a.id, {
                      onSuccess: () => toast('Attachment removed', 'success'),
                      onError: (e) => toast((e as Error).message, 'error'),
                    })
                  }
                  className="text-faint hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {props.canAttach && postApproval && (
        <p className="text-warn mb-2 flex items-start gap-1 text-[11px]">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          This requisition is already approved. Anything you attach now will be marked
          as added after approval.
        </p>
      )}

      {!props.canAttach && !DELETE_LOCKED_STATES.includes(props.status) && (
        <p className="text-faint text-[11px]">
          Only the requester or an approver on this requisition can attach documents.
        </p>
      )}

      {!props.canAttach && postApproval && (
        <p className="text-faint text-[11px]">
          This requisition is approved — only an approver on it can attach further
          documents. Send the file to your approver instead.
        </p>
      )}

      {props.canAttach && (
        <div className="flex items-center gap-2">
          <select
            aria-label="Document type"
            value={docType}
            onChange={(e) => setDocType(e.target.value as RequisitionAttachmentType)}
            className="border-line bg-panel rounded-sm border px-2 py-2 text-[12px]"
          >
            {REQUISITION_ATTACHMENT_TYPE.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="default"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud className="mr-1 h-3.5 w-3.5" />
            {upload.isPending ? 'Uploading…' : 'Attach file'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT.join(',')}
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </section>
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
      {s.isEscalation && <span className="text-warn text-[10px] font-semibold">ESC</span>}
    </span>
  );
}

function BudgetBlock({ budget }: { budget: BudgetCheckResult }): React.JSX.Element {
  const allocated = Number(budget.allocated);
  const committed = Number(budget.committed);
  const consumed = Number(budget.consumed);
  const usedPct =
    allocated > 0 ? Math.min(100, ((committed + consumed) / allocated) * 100) : 0;
  return (
    <div className="border-line bg-panel rounded-lg border p-4">
      <div className="text-faint mb-2 text-[11px] uppercase tracking-wide">Budget</div>
      <dl className="flex flex-col gap-1 text-[12px]">
        <Row label="Allocated" value={inr(budget.allocated)} />
        <Row label="Committed" value={inr(budget.committed)} />
        <Row label="Consumed" value={inr(budget.consumed)} />
        <Row label="Remaining" value={inr(budget.remaining)} strong />
      </dl>
      <div className="bg-canvas mt-2 h-2 w-full overflow-hidden rounded-full">
        <div
          className={
            'h-full rounded-full ' +
            (usedPct > 90 ? 'bg-danger' : usedPct > 70 ? 'bg-warn' : 'bg-accent')
          }
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <div className="text-faint mt-1 text-[10px]">{usedPct.toFixed(0)}% utilised</div>
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
