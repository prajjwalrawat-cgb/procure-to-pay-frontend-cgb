'use client';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Pill,
} from '@/components/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  useOnboardingDecision,
  useOnboardingDetail,
  useRenameVendor,
  useReturnForInfo,
  useReviewScreening,
  useVerifyDocument,
} from '@/lib/api/vendors';
import { useHasPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/shared';
import { useToastStore } from '@/store/toast-store';

const LIGHT_VARIANT: Record<'green' | 'amber' | 'red', 'success' | 'warn' | 'danger'> = {
  green: 'success',
  amber: 'warn',
  red: 'danger',
};

const DOC_VARIANT: Record<string, 'success' | 'warn' | 'danger' | 'gray'> = {
  AUTO_VERIFIED: 'success',
  MANUALLY_VERIFIED: 'success',
  PENDING: 'warn',
  FAILED: 'danger',
  EXPIRED: 'danger',
};

/**
 * Corrects a vendor's name. The legal entity name is what PAN/GST verification
 * matched against, so the API freezes it once the vendor is activated — until
 * then a buyer can fix both here.
 */
function RenameVendorDialog({
  open,
  vendorId,
  currentName,
  currentLegalName,
  onClose,
}: {
  open: boolean;
  vendorId: string;
  currentName: string;
  currentLegalName: string | null;
  onClose: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(currentName);
  const [legalEntityName, setLegalEntityName] = useState(currentLegalName ?? '');
  const rename = useRenameVendor(vendorId);
  const toast = useToastStore((s) => s.push);

  const submit = (): void => {
    rename.mutate(
      {
        name: name.trim(),
        // Only send the legal name when there is one to send, so a vendor who
        // has not reached wizard step 1 yet is not given an empty string.
        ...(legalEntityName.trim() ? { legalEntityName: legalEntityName.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast('Vendor name updated', 'success');
          onClose();
        },
        onError: (e) => toast(e.message || 'Could not update the name', 'error'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Edit vendor name</DialogTitle>
        <DialogDescription>
          The display name is the label used across lists and reports. The legal entity
          name is the registered name that PAN and GST checks match against — it can only
          be corrected before the vendor is activated. The change is recorded in the audit
          log.
        </DialogDescription>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-muted mb-1 block text-[12px] font-medium">
              Display name
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-muted mb-1 block text-[12px] font-medium">
              Legal entity name
            </label>
            <Input
              value={legalEntityName}
              onChange={(e) => setLegalEntityName(e.target.value)}
              placeholder="Lohith Material Pvt Ltd"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            disabled={rename.isPending || name.trim().length < 2}
          >
            {rename.isPending ? 'Saving…' : 'Save name'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OnboardingReviewPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading } = useOnboardingDetail(id);
  const decide = useOnboardingDecision(id);
  const returnForInfo = useReturnForInfo(id);
  const verifyDoc = useVerifyDocument(id);
  const reviewScreening = useReviewScreening(id);
  const toast = useToastStore((s) => s.push);
  const [comment, setComment] = useState('');
  const [renaming, setRenaming] = useState(false);
  // The dossier is readable by anyone with VENDOR_ONBOARDING_READ (finance
  // watches the pipeline), so each write control is gated on its own
  // permission. The decision panel is gated server-side by `canReview`.
  const canRename = useHasPermission(PERMISSIONS.VENDOR_UPDATE);
  const canVerifyDocs = useHasPermission(PERMISSIONS.VENDOR_DOC_VERIFY);
  const canReviewScreening = useHasPermission(PERMISSIONS.VENDOR_SCREENING_REVIEW);

  if (isLoading || !data) return <p className="text-muted p-6 text-[13px]">Loading…</p>;

  const act = (decision: 'APPROVE' | 'REJECT'): void => {
    if (!data.myApprovalId) return;
    decide.mutate(
      { approvalId: data.myApprovalId, decision, comment: comment || undefined },
      {
        onSuccess: () =>
          toast(
            decision === 'APPROVE' ? 'Onboarding approved' : 'Onboarding rejected',
            'success',
          ),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const sendBack = (): void => {
    const item = comment.trim();
    if (!item) {
      toast('Add a note describing what is needed', 'error');
      return;
    }
    returnForInfo.mutate(
      { items: [item], note: item },
      {
        onSuccess: () => toast('Returned to vendor for more info', 'success'),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-4">
        <Link
          href="/vendors/onboarding"
          className="text-muted hover:text-ink text-[12px]"
        >
          ← Onboarding queue
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="tracking-heading text-ink text-[20px] font-semibold">
            {data.vendorName}
          </h1>
          {data.isMsme && <Pill variant="info">MSME</Pill>}
          <Pill variant="gray">{data.lifecycleStatus.replace(/_/g, ' ')}</Pill>
          {canRename && (
            <button
              onClick={() => setRenaming(true)}
              className="text-muted hover:text-ink text-[12px] font-medium underline"
            >
              Edit name
            </button>
          )}
        </div>
        <p className="text-muted text-[13px]">
          {data.legalEntityName} · {data.category ?? '—'} · {data.completionPct}% complete
          · open {data.daysOpen}d
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {/* Risk traffic-lights */}
          <Card>
            <CardHeader>
              <CardTitle>Risk assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.riskLights.map((l) => (
                  <Pill key={l.key} variant={LIGHT_VARIANT[l.state]} dot>
                    {l.label}
                  </Pill>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Wizard steps */}
          <Card>
            <CardHeader>
              <CardTitle>Wizard progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1">
                {data.steps.map((s) => (
                  <li key={s.step} className="flex items-center gap-2 text-[13px]">
                    <span className={s.done ? 'text-accent-2' : 'text-faint'}>
                      {s.done ? '●' : '○'}
                    </span>
                    <span className={s.done ? 'text-ink' : 'text-muted'}>
                      {s.step}. {s.name}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {data.documents.length === 0 ? (
                <p className="text-muted text-[13px]">No documents uploaded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.documents.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <div>
                        <span className="text-ink font-medium">
                          {d.docType.replace(/_/g, ' ')}
                        </span>
                        {d.url ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand ml-2 font-medium hover:underline"
                          >
                            {d.filename}
                          </a>
                        ) : (
                          <span className="text-muted ml-2">
                            {d.filename} (file unavailable)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {d.url && (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand text-[12px] font-medium hover:underline"
                          >
                            View
                          </a>
                        )}
                        <Pill variant={DOC_VARIANT[d.verificationStatus] ?? 'gray'}>
                          {d.verificationStatus.replace(/_/g, ' ')}
                        </Pill>
                        {d.verificationStatus === 'PENDING' && canVerifyDocs && (
                          <>
                            <Button
                              variant="default"
                              onClick={() =>
                                verifyDoc.mutate(
                                  { docId: d.id, decision: 'VERIFIED' },
                                  {
                                    onSuccess: () =>
                                      toast('Document verified', 'success'),
                                  },
                                )
                              }
                            >
                              Verify
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                verifyDoc.mutate(
                                  {
                                    docId: d.id,
                                    decision: 'REJECTED',
                                    reason: 'Illegible',
                                  },
                                  {
                                    onSuccess: () =>
                                      toast('Document rejected', 'success'),
                                  },
                                )
                              }
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Screenings */}
          <Card>
            <CardHeader>
              <CardTitle>Screenings</CardTitle>
            </CardHeader>
            <CardContent>
              {data.screenings.length === 0 ? (
                <p className="text-muted text-[13px]">No screenings run yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.screenings.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <span className="text-ink">
                        {s.screeningType.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Pill
                          variant={
                            s.status === 'CLEAR'
                              ? 'success'
                              : s.status === 'FLAGGED'
                                ? 'danger'
                                : 'warn'
                          }
                        >
                          {s.status}
                        </Pill>
                        {s.status === 'FLAGGED' && canReviewScreening && (
                          <Button
                            variant="default"
                            onClick={() =>
                              reviewScreening.mutate(
                                {
                                  screeningId: s.id,
                                  decision: 'ACCEPT_RISK',
                                  notes: 'Reviewed',
                                },
                                { onSuccess: () => toast('Risk accepted', 'success') },
                              )
                            }
                          >
                            Accept risk
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Beneficial owners */}
          {data.beneficialOwners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Beneficial owners</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-[13px]">
                  {data.beneficialOwners.map((o) => (
                    <li key={o.id} className="flex justify-between">
                      <span className="text-ink">
                        {o.ownerName}{' '}
                        <span className="text-muted">({o.ownershipPct}%)</span>
                      </span>
                      {o.isPep && <Pill variant="warn">PEP</Pill>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Decision panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent>
              {data.canReview ? (
                <>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Comment / reason (required to return or reject)…"
                    className="border-line bg-surface text-ink mb-3 w-full rounded-md border px-3 py-2 text-[13px]"
                    rows={4}
                  />
                  <div className="space-y-2">
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={decide.isPending}
                      onClick={() => act('APPROVE')}
                    >
                      Approve & activate
                    </Button>
                    <Button
                      variant="default"
                      className="w-full"
                      disabled={returnForInfo.isPending}
                      onClick={sendBack}
                    >
                      Return for info
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full"
                      disabled={decide.isPending}
                      onClick={() => act('REJECT')}
                    >
                      Reject
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-muted text-[13px]">
                  This onboarding is not currently awaiting your review.
                </p>
              )}
              <div className="text-muted mt-4 text-[12px]">
                CoC acknowledged:{' '}
                {data.cocAcknowledgedAt
                  ? new Date(data.cocAcknowledgedAt).toLocaleDateString()
                  : 'no'}
                <br />
                SLA target: {data.slaTargetHours}h
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {renaming && (
        // Keyed on the current values so the inputs start from what is on screen
        // after a save, rather than the values captured on first render.
        <RenameVendorDialog
          open={renaming}
          vendorId={data.vendorId}
          currentName={data.vendorName}
          currentLegalName={data.legalEntityName}
          onClose={() => setRenaming(false)}
        />
      )}
    </div>
  );
}
