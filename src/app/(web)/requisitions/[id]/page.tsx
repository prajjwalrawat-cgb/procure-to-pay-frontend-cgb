'use client';

import {
  ApprovalChain,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ErrorState,
  Input,
  PageHeader,
  Pill,
  Skeleton,
  StageStrip,
  Textarea,
  cn,
  controlClass,
} from '@/components/ui';
import { AlertTriangle, ArrowLeft, FileText, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type {
  BudgetCheckResult,
  RequisitionAttachmentType,
  RequisitionAttachmentView,
} from '@/lib/shared';

import { DocumentLedger } from '@/components/document-ledger';
import { useRequesterName } from '@/components/requisitions/requester';
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
import {
  formatDate,
  formatDateTime,
  humanise,
  inr,
  statusLabel,
  statusVariant,
} from '@/lib/format';
import { priorityLabel, priorityVariant } from '@/lib/refs';
import { useToastStore } from '@/store/toast-store';

export default function RequisitionDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const { data, isLoading, error, refetch } = useRequisition(id);
  const personName = useRequesterName();

  const submit = useSubmitRequisition(id);
  const withdraw = useWithdrawRequisition(id);
  const cancel = useCancelRequisition(id);
  const decide = useDecideRequisition(id);
  const addComment = useAddRequisitionComment(id);

  const [comment, setComment] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [reasonFor, setReasonFor] = useState<'withdraw' | 'cancel' | null>(null);

  if (isLoading) return <DetailSkeleton />;
  if (error || !data) {
    return (
      <div>
        <BackLink />
        <ErrorState error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  // The detail endpoint falls back to the user id when the requester's name
  // can't be found; never print that as a name.
  const requester = personName(data.requester);

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

  const onReason = (reason: string): void => {
    const m = reasonFor === 'withdraw' ? withdraw : cancel;
    m.mutate(reason, {
      onSuccess: () => {
        toast(
          reasonFor === 'withdraw' ? 'Requisition withdrawn' : 'Requisition cancelled',
          'success',
        );
        setReasonFor(null);
      },
      onError: (e) => toast((e as Error).message, 'error'),
    });
  };

  const hasActions =
    data.canDecide ||
    data.canWithdraw ||
    data.canCancel ||
    data.canEdit ||
    data.canSubmit ||
    data.canCreatePo ||
    data.status === 'DRAFT';

  return (
    <div className={hasActions ? 'pb-24' : 'pb-8'}>
      <BackLink />

      <PageHeader
        title={data.number}
        numeric
        meta={
          <>
            <Pill variant={statusVariant(data.status)} dot>
              {statusLabel(data.status)}
            </Pill>
            {data.priority !== 'STANDARD' && (
              <Badge variant={priorityVariant(data.priority)}>
                {priorityLabel(data.priority)}
              </Badge>
            )}
          </>
        }
        description={
          <>
            <span className="text-text block text-h3 font-medium">{data.title}</span>
            <span className="mt-0.5 block text-body-sm">
              {[
                requester ? `Raised by ${requester}` : null,
                data.requester.deptName,
                `Needed ${formatDate(data.neededBy)}`,
                `${data.agingDays}d since raised`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </>
        }
      />

      <Card className="mb-6 p-3.5">
        <StageStrip
          stages={data.stages.map((s) => ({ key: s.key, label: s.label }))}
          activeIndex={Math.max(
            0,
            data.stages.findIndex((s) => s.state === 'active'),
          )}
          failed={data.status === 'REJECTED' || data.status === 'CANCELLED'}
          failedLabel={statusLabel(data.status)}
        />
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {data.businessJustification && (
            <Card>
              <CardHeader>
                <CardTitle>Business justification</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-text whitespace-pre-line text-body-sm leading-relaxed">
                  {data.businessJustification}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            {/* Scrolls inside the card on a phone; the page itself never does. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-body-sm">
                <thead className="border-line text-muted border-y text-left">
                  <tr>
                    <th className="min-w-[200px] px-3 py-2.5 text-caption font-medium">Item</th>
                    <th className="px-3 py-2.5 text-caption font-medium">HSN</th>
                    <th className="px-3 py-2.5 text-right text-caption font-medium">Qty</th>
                    <th className="px-3 py-2.5 text-right text-caption font-medium">On PO</th>
                    <th className="px-3 py-2.5 text-right text-caption font-medium">Received</th>
                    <th className="px-3 py-2.5 text-right text-caption font-medium">
                      Line total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l) => (
                    <tr key={l.id} className="border-line border-b last:border-b-0">
                      <td className="px-3 py-3">
                        <div className="text-text">{l.itemDesc}</div>
                        <div className="font-numeric text-faint text-micro">
                          {l.skuCode ?? 'Non-catalogued'}
                          {l.preferredVendor ? ` · ${l.preferredVendor.name}` : ''}
                        </div>
                      </td>
                      <td className="font-numeric text-muted px-3 py-3">{l.hsnCode ?? '—'}</td>
                      <td className="font-numeric text-text px-3 py-3 text-right">
                        {l.qty} {l.uom}
                      </td>
                      <td className="font-numeric text-muted px-3 py-3 text-right">
                        {l.qtyIssued}
                      </td>
                      <td className="font-numeric text-muted px-3 py-3 text-right">
                        {l.qtyReceived}
                      </td>
                      <td className="font-numeric text-ink px-3 py-3 text-right font-medium">
                        {inr(l.lineTotal)}
                      </td>
                    </tr>
                  ))}
                  {data.lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-muted px-3 py-6 text-center text-caption">
                        No line items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval route</CardTitle>
            </CardHeader>
            <CardContent>
              {data.liveApprovalChain.length === 0 ? (
                <p className="text-muted text-caption">
                  {data.status === 'DRAFT'
                    ? 'The approval route is set when the requisition is submitted.'
                    : 'No approval steps recorded.'}
                </p>
              ) : (
                <ApprovalChain steps={data.liveApprovalChain} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purchase orders</CardTitle>
            </CardHeader>
            <CardContent>
              {data.poConversions.length === 0 ? (
                <p className="text-muted text-caption">
                  No purchase orders raised from this requisition yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.poConversions.map((po) => (
                    <Link
                      key={po.id}
                      href={`/purchase-orders/${po.id}`}
                      className="border-line hover:border-accent/40 duration-hover flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-sm border px-3 py-2.5 text-body-sm transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="font-numeric text-ink font-medium">{po.number}</span>{' '}
                        <span className="text-muted">{po.vendorName}</span>
                      </span>
                      <span className="flex items-center gap-3">
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
            </CardContent>
          </Card>

          <AttachmentsSection
            id={id}
            attachments={data.attachments}
            status={data.status}
            canAttach={data.canAttach}
          />

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="border-line mb-4 flex flex-col gap-2 border-l pl-4">
                {data.activity.map((a) => {
                  const who = a.actorId ? personName({ id: a.actorId, name: '' }) : null;
                  return (
                    <li key={a.id} className="text-muted text-caption">
                      <span className="text-text font-medium">{humanise(a.action)}</span>
                      {who ? ` · ${who}` : ''} ·{' '}
                      <span className="font-numeric">{formatDateTime(a.at)}</span>
                    </li>
                  );
                })}
                {data.activity.length === 0 && (
                  <li className="text-faint text-caption">No activity yet.</li>
                )}
              </ul>

              {data.comments.length > 0 && (
                <div className="mb-4 flex flex-col gap-2">
                  {data.comments.map((c) => (
                    <div key={c.id} className="border-line rounded-sm border px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-x-3">
                        <span className="text-text text-body-sm font-medium">
                          {c.authorName}
                        </span>
                        <span className="font-numeric text-faint text-micro">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-muted mt-0.5 whitespace-pre-line text-body-sm">
                        {c.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  addComment.mutate(comment, {
                    onSuccess: () => {
                      setComment('');
                      toast('Comment added', 'success');
                    },
                    onError: (err) => toast((err as Error).message, 'error'),
                  });
                }}
              >
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment…"
                  aria-label="Comment"
                  className="min-w-0 flex-1"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={!comment.trim() || addComment.isPending}
                >
                  Comment
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card className="p-4">
            <div className="text-muted text-caption">Total</div>
            <div className="font-numeric text-ink mt-1 text-h1 font-semibold">
              {inr(data.amounts.total)}
            </div>
            <dl className="mt-3 flex flex-col gap-1.5 text-body-sm">
              <Row
                label={`Taxable (${data.amounts.taxKind})`}
                value={inr(data.amounts.subtotal)}
              />
              <Row label="Tax" value={inr(data.amounts.taxAmount)} />
              {data.committedAmount && (
                <Row label="Committed" value={inr(data.committedAmount)} />
              )}
            </dl>
          </Card>

          {data.budget && <BudgetBlock budget={data.budget} />}

          <Card className="p-4">
            <h2 className="text-ink mb-2 text-h3 font-semibold">Requester</h2>
            {requester && <div className="text-text mb-1 text-body-sm font-medium">{requester}</div>}
            <dl className="flex flex-col gap-1.5 text-body-sm">
              <Row label="Department" value={data.requester.deptName ?? '—'} />
              <Row
                label="Cost centre"
                value={`${data.costCenter.code}, ${data.costCenter.name}`}
              />
              <Row label="Plant" value={data.plant.name} />
              <Row label="Delivery" value={data.deliveryLocation ?? '—'} />
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="text-ink mb-2 text-h3 font-semibold">Scheduling</h2>
            <dl className="flex flex-col gap-1.5 text-body-sm">
              <Row label="Priority" value={priorityLabel(data.priority)} />
              <Row label="Needed by" value={formatDate(data.neededBy)} />
              <Row label="Raised" value={formatDate(data.createdAt)} />
              <Row label="Age" value={`${data.agingDays}d`} />
            </dl>
          </Card>

          {/* The trust column. Same position on every document detail page. */}
          <DocumentLedger entityId={data.id} />
        </aside>
      </div>

      {/* Sticky action bar, aligned to the shell's content column. */}
      {hasActions && (
        <div className="border-line bg-panel/95 fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur">
          <div className="pf-container flex flex-wrap items-center justify-between gap-2 py-3 sm:gap-3">
            {data.canDecide ? (
              <>
                <Input
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Add a decision comment…"
                  aria-label="Decision comment"
                  className="min-w-0 flex-1 basis-full sm:basis-auto"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => onDecide('REJECT')}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => onDecide('REQUEST_CHANGES')}
                  >
                    Request changes
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() => onDecide('APPROVE')}
                  >
                    Approve
                  </Button>
                </div>
              </>
            ) : (
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {/* A draft with no permitted actions would otherwise render an
                    empty bar, leaving the user with no idea why. */}
                {data.status === 'DRAFT' && !data.canSubmit && !data.canEdit && (
                  <span className="text-muted text-caption">
                    You can view this draft but not submit it — ask a Procurement Head or an
                    admin.
                  </span>
                )}
                {data.canWithdraw && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={withdraw.isPending}
                    onClick={() => setReasonFor('withdraw')}
                  >
                    Withdraw
                  </Button>
                )}
                {data.canCancel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cancel.isPending}
                    onClick={() => setReasonFor('cancel')}
                  >
                    Cancel requisition
                  </Button>
                )}
                {data.canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/requisitions/${id}/edit`)}
                  >
                    Edit
                  </Button>
                )}
                {/* Submit (draft) and Create PO (approved) are mutually
                    exclusive states, so this is still one primary. */}
                {data.canSubmit && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={submit.isPending}
                    onClick={onSubmit}
                  >
                    {submit.isPending ? 'Submitting…' : 'Submit for approval'}
                  </Button>
                )}
                {data.canCreatePo && (
                  <Button
                    variant="primary"
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
      )}

      <ReasonDialog
        key={reasonFor ?? 'closed'}
        kind={reasonFor}
        number={data.number}
        busy={withdraw.isPending || cancel.isPending}
        onClose={() => setReasonFor(null)}
        onConfirm={onReason}
      />
    </div>
  );
}

function BackLink(): React.JSX.Element {
  return (
    <Link
      href="/requisitions"
      className="text-muted hover:text-text mb-3 inline-flex items-center gap-1 text-caption"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to requisitions
    </Link>
  );
}

function DetailSkeleton(): React.JSX.Element {
  return (
    <div aria-busy="true" aria-live="polite">
      <Skeleton className="mb-4 h-3 w-32" />
      <Skeleton className="mb-2 h-6 w-48" />
      <Skeleton className="mb-6 h-4 w-80 max-w-full" />
      <Skeleton className="mb-6 h-14 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Withdraw and cancel both need a reason on the record. This replaces the
 * old window.prompt, which could not be styled, validated or read on mobile.
 */
function ReasonDialog({
  kind,
  number,
  busy,
  onClose,
  onConfirm,
}: {
  kind: 'withdraw' | 'cancel' | null;
  number: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}): React.JSX.Element {
  const [reason, setReason] = useState('');
  const isCancel = kind === 'cancel';
  return (
    <Dialog
      open={kind !== null}
      onOpenChange={(o) => {
        if (!o && !busy) {
          setReason('');
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogTitle>
          {isCancel ? `Cancel ${number}?` : `Withdraw ${number}?`}
        </DialogTitle>
        <DialogDescription className="mt-1">
          {isCancel
            ? 'The requisition is closed for good and its budget commitment released.'
            : 'The requisition is pulled back from its approvers.'}{' '}
          The reason is kept on the audit trail.
        </DialogDescription>
        <label className="mt-4 block">
          <span className="text-text mb-1.5 block text-caption font-medium">Reason</span>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isCancel ? 'Why is this no longer needed?' : 'Why are you withdrawing it?'}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button
            variant={isCancel ? 'danger' : 'primary'}
            disabled={!reason.trim() || busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {isCancel ? 'Cancel requisition' : 'Withdraw'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
    <Card>
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
      </CardHeader>
      <CardContent>
      {props.attachments.length === 0 ? (
        <div className="text-muted mb-3 text-caption">
          No quotations, proforma invoices or specs attached yet.
        </div>
      ) : (
        <div className="border-line divide-line mb-3 divide-y rounded-sm border">
          {props.attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="text-faint h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-2 block truncate text-body-sm underline underline-offset-2"
                  >
                    {a.filename}
                  </a>
                ) : (
                  <span className="text-text block truncate text-body-sm">
                    {a.filename}
                  </span>
                )}
                <div className="text-muted text-caption">
                  {DOC_TYPE_LABEL[a.docType] ?? a.docType} ·{' '}
                  <span className="font-numeric">{fileSize(a.sizeBytes)}</span> ·{' '}
                  {a.uploadedByName ?? 'Unknown'} ·{' '}
                  <span className="font-numeric">{formatDate(a.uploadedAt)}</span>
                </div>
                {a.addedAfterApproval && (
                  <div className="text-warn mt-0.5 flex items-center gap-1 text-caption font-medium">
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
                  className="text-faint hover:text-danger rounded-sm p-1"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {props.canAttach && postApproval && (
        <p className="text-warn mb-2 flex items-start gap-1 text-caption">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          This requisition is already approved. Anything you attach now will be marked
          as added after approval.
        </p>
      )}

      {!props.canAttach && !DELETE_LOCKED_STATES.includes(props.status) && (
        <p className="text-muted text-caption">
          Only the requester or an approver on this requisition can attach documents.
        </p>
      )}

      {!props.canAttach && postApproval && (
        <p className="text-muted text-caption">
          This requisition is approved — only an approver on it can attach further
          documents. Send the file to your approver instead.
        </p>
      )}

      {props.canAttach && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Document type"
            value={docType}
            onChange={(e) => setDocType(e.target.value as RequisitionAttachmentType)}
            className={cn(controlClass, 'w-auto')}
          >
            {REQUISITION_ATTACHMENT_TYPE.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud className="h-3.5 w-3.5" aria-hidden />
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
      </CardContent>
    </Card>
  );
}

function BudgetBlock({ budget }: { budget: BudgetCheckResult }): React.JSX.Element {
  const allocated = Number(budget.allocated);
  const committed = Number(budget.committed);
  const consumed = Number(budget.consumed);
  const usedPct =
    allocated > 0 ? Math.min(100, ((committed + consumed) / allocated) * 100) : 0;
  return (
    <Card className="p-4">
      <h2 className="text-ink mb-2 text-h3 font-semibold">Budget</h2>
      <dl className="flex flex-col gap-1.5 text-body-sm">
        <Row label="Allocated" value={inr(budget.allocated)} />
        <Row label="Committed" value={inr(budget.committed)} />
        <Row label="Consumed" value={inr(budget.consumed)} />
        <Row label="Remaining" value={inr(budget.remaining)} strong />
      </dl>
      <div className="bg-canvas mt-2 h-2 w-full overflow-hidden rounded-full">
        <div className={
            'h-full rounded-full ' +
            (usedPct > 90 ? 'bg-danger-solid' : usedPct > 70 ? 'bg-warn-solid' : 'bg-success-solid')
          }
          style={{ width: `${usedPct}%` }}
        />
      </div>
      <div className="text-muted mt-1 text-caption">{usedPct.toFixed(0)}% utilised</div>
    </Card>
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
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd
        className={
          'font-numeric min-w-0 text-right ' + (strong ? 'text-ink font-semibold' : 'text-text')
        }
      >
        {value}
      </dd>
    </div>
  );
}
